import {
    Injectable,
    Logger,
    OnModuleDestroy,
    OnModuleInit,
} from '@nestjs/common';
import {CronJob} from 'cron';
import {SchedulerRegistry} from '@nestjs/schedule';
import {InjectRepository} from '@nestjs/typeorm';
import {DataSource, In, Repository} from 'typeorm';
import {TransactionEntity} from '../entities/transaction.entity';
import {TonTransferEntity} from '../entities/ton-transfer.entity';
import {TransactionType} from '../../../common/constants/payments/transaction-type.constants';
import {TransactionDirection} from '../../../common/constants/payments/transaction-direction.constants';
import {TransactionStatus} from '../../../common/constants/payments/transaction-status.constants';
import {TonTransferStatus} from '../../../common/constants/payments/ton-transfer-status.constants';
import {TonTransferType} from '../../../common/constants/payments/ton-transfer-type.constants';
import {TonHotWalletService} from '../ton/ton-hot-wallet.service';
import {LedgerService} from '../ledger/ledger.service';
import {PaymentsProcessingConfigService} from './payments-processing-config.service';
import {withAdvisoryLock} from './advisory-lock';
import {ensureTransitionAllowed} from '../payouts/payout-state';

@Injectable()
export class PayoutExecutionService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger('PayoutExecution');
    private job?: CronJob;
    private isRunning = false;

    constructor(
        private readonly schedulerRegistry: SchedulerRegistry,
        private readonly dataSource: DataSource,
        @InjectRepository(TransactionEntity)
        private readonly transactionRepository: Repository<TransactionEntity>,
        @InjectRepository(TonTransferEntity)
        private readonly transferRepository: Repository<TonTransferEntity>,
        private readonly ledgerService: LedgerService,
        private readonly tonHotWalletService: TonHotWalletService,
        private readonly config: PaymentsProcessingConfigService,
    ) {}

    onModuleInit(): void {
        const expression = `*/${this.config.payoutCronEverySeconds} * * * * *`;
        this.job = new CronJob(expression, () => {
            void this.processQueue();
        });
        this.schedulerRegistry.addCronJob('payout-execution', this.job);
        this.job.start();
        this.logger.log(`Payout execution scheduled: ${expression}`);
    }

    onModuleDestroy(): void {
        if (this.job) {
            this.job.stop();
            this.schedulerRegistry.deleteCronJob('payout-execution');
        }
    }

    async processQueue(): Promise<void> {
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        try {
            const payouts = await this.transactionRepository.find({
                where: {
                    type: TransactionType.PAYOUT,
                    direction: TransactionDirection.OUT,
                    status: In([
                        TransactionStatus.PENDING,
                        TransactionStatus.BLOCKED_LIQUIDITY,
                    ]),
                },
                take: this.config.payoutBatchLimit,
                order: {updatedAt: 'ASC'},
            });

            for (const payout of payouts) {
                await this.processPayout(payout);
            }
        } finally {
            this.isRunning = false;
        }
    }

    private async processPayout(payout: TransactionEntity): Promise<void> {
        await withAdvisoryLock(this.dataSource, `payout:${payout.id}`, async () => {
            const locked = await this.dataSource.transaction(
                async (manager) => {
                    const txRepo = manager.getRepository(TransactionEntity);
                    const transferRepo = manager.getRepository(TonTransferEntity);
                    const current = await txRepo.findOne({
                        where: {id: payout.id},
                        lock: {mode: 'pessimistic_write'},
                    });

                    if (
                        !current ||
                        current.type !== TransactionType.PAYOUT ||
                        current.direction !== TransactionDirection.OUT
                    ) {
                        return null;
                    }

                    if (
                        ![
                            TransactionStatus.PENDING,
                            TransactionStatus.BLOCKED_LIQUIDITY,
                        ].includes(current.status)
                    ) {
                        return null;
                    }

                    if (current.externalTxHash) {
                        this.logger.log(
                            `Skip broadcast: already has tx hash`,
                            JSON.stringify({
                                payoutId: current.id,
                                externalTxHash: current.externalTxHash,
                            }),
                        );
                        return null;
                    }

                    if (!current.destinationAddress) {
                        await this.failPayout(
                            txRepo,
                            current,
                            'Destination address missing',
                        );
                        return null;
                    }

                    if (current.tonTransferId) {
                        const existing = await transferRepo.findOne({
                            where: {id: current.tonTransferId},
                        });
                        if (existing && existing.status !== TonTransferStatus.FAILED) {
                            this.logger.log(
                                `Skip broadcast: already broadcasted`,
                                JSON.stringify({
                                    payoutId: current.id,
                                    tonTransferId: existing.id,
                                    status: existing.status,
                                }),
                            );
                            return null;
                        }
                        if (existing && existing.status === TonTransferStatus.FAILED) {
                            await this.failPayout(
                                txRepo,
                                current,
                                'Existing transfer failed',
                            );
                            return null;
                        }
                        if (!existing) {
                            await this.failPayout(
                                txRepo,
                                current,
                                'Missing transfer for payout',
                            );
                            return null;
                        }
                    }

                    const amountNano = BigInt(current.amountNano);
                    const totalDebitNano = BigInt(
                        current.totalDebitNano || current.amountNano,
                    );
                    if (amountNano <= 0n || totalDebitNano <= 0n) {
                        await this.failPayout(txRepo, current, 'Invalid payout amount');
                        return null;
                    }

                    const balance = await this.ledgerService.getWithdrawableBalance(
                        current.userId,
                        current.currency,
                        manager,
                    );
                    const availableForPayout =
                        BigInt(balance.withdrawableNano) + totalDebitNano;
                    if (availableForPayout < totalDebitNano) {
                        await this.failPayout(
                            txRepo,
                            current,
                            'Reserved balance is insufficient',
                        );
                        return null;
                    }

                    let transfer: TonTransferEntity | null = null;
                    if (!current.tonTransferId) {
                        const idempotencyKey = `payout:${current.id}`;
                        transfer = await transferRepo.findOne({
                            where: {idempotencyKey},
                        });
                        if (!transfer) {
                            const now = new Date();
                            const observedWindowMs = 6 * 60 * 60 * 1000;
                            transfer = transferRepo.create({
                                transactionId: current.id,
                                dealId: current.dealId ?? null,
                                escrowWalletId: null,
                                idempotencyKey,
                                type: TonTransferType.PAYOUT,
                                status: this.config.payoutDryRun
                                    ? TonTransferStatus.SIMULATED
                                    : TonTransferStatus.PENDING,
                                network: current.currency,
                                fromAddress: this.config.hotWalletAddress ?? '',
                                toAddress: current.destinationAddress,
                                amountNano: current.amountNano,
                                txHash: null,
                                observedAt: this.config.payoutDryRun ? now : null,
                                raw: {dryRun: this.config.payoutDryRun},
                                errorMessage: null,
                            });
                            transfer = await transferRepo.save(transfer);

                            await txRepo.update(current.id, {
                                expectedObservedAfter: new Date(
                                    now.getTime() - observedWindowMs,
                                ),
                                expectedObservedBefore: new Date(
                                    now.getTime() + observedWindowMs,
                                ),
                            });
                        }

                        await txRepo.update(current.id, {
                            tonTransferId: transfer.id,
                        });
                        current.tonTransferId = transfer.id;
                    }

                    return {
                        payout: current,
                        transfer,
                    };
                },
            );

            if (!locked) {
                return;
            }

            const {payout: lockedPayout, transfer} = locked;
            if (!transfer) {
                return;
            }

            if (
                lockedPayout.type !== TransactionType.PAYOUT ||
                lockedPayout.direction !== TransactionDirection.OUT
            ) {
                this.logger.warn(
                    `Skip broadcast: invalid payout type or direction`,
                    JSON.stringify({
                        payoutId: lockedPayout.id,
                        type: lockedPayout.type,
                        direction: lockedPayout.direction,
                    }),
                );
                return;
            }

            if (lockedPayout.externalTxHash || lockedPayout.tonTransferId !== transfer.id) {
                this.logger.log(
                    `Skip broadcast: already broadcasted`,
                    JSON.stringify({
                        payoutId: lockedPayout.id,
                        tonTransferId: lockedPayout.tonTransferId,
                        externalTxHash: lockedPayout.externalTxHash,
                    }),
                );
                return;
            }

            const hotBalanceNano = await this.tonHotWalletService.getBalance();
            const reservedNano = await this.ledgerService.getReservedPayoutsTotal(
                lockedPayout.currency,
            );
            const canSpendNano = hotBalanceNano - BigInt(reservedNano);

            if (canSpendNano < BigInt(lockedPayout.amountNano)) {
                await this.transactionRepository.update(lockedPayout.id, {
                    status: TransactionStatus.BLOCKED_LIQUIDITY,
                    errorCode: 'INSUFFICIENT_LIQUIDITY',
                    errorMessage: 'Insufficient hot wallet liquidity',
                });
                this.logger.warn(
                    `Payout blocked by liquidity`,
                    JSON.stringify({
                        payoutId: lockedPayout.id,
                        amountNano: lockedPayout.amountNano,
                        hotBalanceNano: hotBalanceNano.toString(),
                        reservedNano,
                    }),
                );
                return;
            }

            if (this.config.payoutDryRun) {
                await this.transferRepository.update(transfer.id, {
                    status: TonTransferStatus.SIMULATED,
                    observedAt: new Date(),
                    errorMessage: null,
                });
                ensureTransitionAllowed(
                    lockedPayout.status,
                    TransactionStatus.COMPLETED,
                );
                await this.transactionRepository.update(lockedPayout.id, {
                    status: TransactionStatus.COMPLETED,
                    confirmedAt: new Date(),
                    completedAt: new Date(),
                });
                await this.ledgerService.updateFeeTransactionsStatus(
                    lockedPayout.id,
                    TransactionStatus.COMPLETED,
                );
                this.logger.log(
                    `Payout simulated`,
                    JSON.stringify({
                        payoutId: lockedPayout.id,
                        tonTransferId: transfer.id,
                        amountNano: lockedPayout.amountNano,
                        destination: lockedPayout.destinationAddress,
                    }),
                );
                return;
            }

            try {
                await this.tonHotWalletService.sendTon({
                    toAddress: lockedPayout.destinationAddress ?? '',
                    amountNano: BigInt(lockedPayout.amountNano),
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                await this.transferRepository.update(transfer.id, {
                    status: TonTransferStatus.FAILED,
                    errorMessage: message,
                });
                ensureTransitionAllowed(
                    lockedPayout.status,
                    TransactionStatus.FAILED,
                );
                await this.transactionRepository.update(lockedPayout.id, {
                    status: TransactionStatus.FAILED,
                    errorCode: 'PAYOUT_FAILED',
                    errorMessage: message,
                });
                await this.ledgerService.updateFeeTransactionsStatus(
                    lockedPayout.id,
                    TransactionStatus.CANCELED,
                );
                this.logger.warn(
                    `Payout broadcast failed`,
                    JSON.stringify({
                        payoutId: lockedPayout.id,
                        tonTransferId: transfer.id,
                        error: message,
                    }),
                );
                return;
            }

            ensureTransitionAllowed(
                lockedPayout.status,
                TransactionStatus.AWAITING_CONFIRMATION,
            );
            await this.transactionRepository.update(lockedPayout.id, {
                status: TransactionStatus.AWAITING_CONFIRMATION,
                errorCode: null,
                errorMessage: null,
            });
            this.logger.log(
                `Payout broadcasted`,
                JSON.stringify({
                    payoutId: lockedPayout.id,
                    tonTransferId: transfer.id,
                    amountNano: lockedPayout.amountNano,
                    destination: lockedPayout.destinationAddress,
                }),
            );
        });
    }

    private async failPayout(
        txRepo: Repository<TransactionEntity>,
        payout: TransactionEntity,
        reason: string,
    ): Promise<void> {
        ensureTransitionAllowed(payout.status, TransactionStatus.FAILED);
        await txRepo.update(payout.id, {
            status: TransactionStatus.FAILED,
            errorCode: 'PAYOUT_INVALID',
            errorMessage: reason,
        });
        await this.ledgerService.updateFeeTransactionsStatus(
            payout.id,
            TransactionStatus.CANCELED,
        );
        this.logger.warn(
            `Payout failed`,
            JSON.stringify({
                payoutId: payout.id,
                reason,
            }),
        );
    }
}
