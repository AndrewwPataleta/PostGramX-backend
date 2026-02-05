import {Injectable, Logger} from '@nestjs/common';
import {Cron} from '@nestjs/schedule';
import {InjectRepository} from '@nestjs/typeorm';
import {DataSource, In, Repository} from 'typeorm';
import {DealEntity} from '../deals/entities/deal.entity';
import {DealEscrowEntity} from '../deals/entities/deal-escrow.entity';
import {EscrowWalletEntity} from './entities/escrow-wallet.entity';
import {EscrowWalletKeyEntity} from './entities/escrow-wallet-key.entity';
import {EscrowStatus} from '../../common/constants/deals/deal-escrow-status.constants';
import {DealStage} from '../../common/constants/deals/deal-stage.constants';
import {mapStageToDealStatus} from '../deals/state/deal-status.mapper';
import {DealsNotificationsService} from '../deals/deals-notifications.service';
import {TonTransferEntity} from './entities/ton-transfer.entity';
import {TransactionEntity} from './entities/transaction.entity';
import {TransactionStatus} from '../../common/constants/payments/transaction-status.constants';
import {TransactionType} from '../../common/constants/payments/transaction-type.constants';
import {TransactionDirection} from '../../common/constants/payments/transaction-direction.constants';
import {TonCenterClient} from './ton/toncenter.client';
import {addNano, gteNano, subNano} from './utils/bigint';
import {CurrencyCode} from '../../common/constants/currency/currency.constants';
import {KeyEncryptionService} from './wallets/crypto/key-encryption.service';
import {TonWalletDeploymentService} from './ton/ton-wallet-deployment.service';
import {TonTransferStatus} from '../../common/constants/payments/ton-transfer-status.constants';
import {TonTransferType} from '../../common/constants/payments/ton-transfer-type.constants';
import {TonHotWalletService} from './ton/ton-hot-wallet.service';
import {LedgerService} from './ledger/ledger.service';
import {ensureTransitionAllowed} from './payouts/payout-state';
import {FeesConfigService} from './fees/fees-config.service';
import {Address} from '@ton/ton';
import {TelegramMessengerService} from '../telegram/telegram-messenger.service';
import {User} from '../auth/entities/user.entity';

@Injectable()
export class TonPaymentWatcher {
    private readonly logger = new Logger(`${CurrencyCode.TON}-WATCHER`);

    constructor(
        private readonly ton: TonCenterClient,
        private readonly dataSource: DataSource,
        private readonly dealsNotificationsService: DealsNotificationsService,
        @InjectRepository(TransactionEntity)
        private readonly txRepo: Repository<TransactionEntity>,
        @InjectRepository(DealEscrowEntity)
        private readonly escrowRepo: Repository<DealEscrowEntity>,
        @InjectRepository(DealEntity)
        private readonly dealRepo: Repository<DealEntity>,
        @InjectRepository(EscrowWalletEntity)
        private readonly escrowWalletRepo: Repository<EscrowWalletEntity>,
        @InjectRepository(EscrowWalletKeyEntity)
        private readonly escrowWalletKeyRepo: Repository<EscrowWalletKeyEntity>,
        private readonly keyEncryptionService: KeyEncryptionService,
        private readonly tonWalletDeploymentService: TonWalletDeploymentService,
        private readonly tonHotWalletService: TonHotWalletService,
        private readonly ledgerService: LedgerService,
        private readonly feesConfigService: FeesConfigService,
        private readonly telegramMessengerService: TelegramMessengerService,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
    ) {}

    @Cron('*/15 * * * * *')
    async monitorIncomingPayments() {
        try {

            const escrows = await this.escrowRepo.find({
                where: {
                    status: In([
                        EscrowStatus.AWAITING_PAYMENT,
                        EscrowStatus.PAID_PARTIAL,
                    ]),
                },
                take: 20,
            });

            if (!escrows.length) {
                return;
            }

            for (const escrow of escrows) {
                if (!escrow.depositAddress) {
                    continue;
                }

                const transactions = await this.ton.getTransactions(
                    escrow.depositAddress,
                    10,
                );

                for (const entry of transactions) {
                    const inMsg = (entry as any).in_msg;
                    if (!inMsg?.value) {
                        continue;
                    }

                    const amountNano = String(inMsg.value);
                    const txHashRaw =
                        (entry as any).transaction_id?.hash ?? (entry as any).hash;
                    if (!txHashRaw) {
                        continue;
                    }
                    const txHash = String(txHashRaw).toLowerCase();
                    const observedAt = new Date(Number((entry as any).utime) * 1000);
                    await this.processTransfer(escrow, {
                        txHash,
                        amountNano,
                        fromAddress: inMsg.source ?? 'unknown',
                        toAddress: escrow.depositAddress,
                        observedAt,
                        raw: entry as any,
                    });
                }
            }
        } catch (err) {
            this.logger.error(
                'Watcher error',
                err instanceof Error ? err.stack : String(err),
            );
        }
    }

    @Cron('*/20 * * * * *')
    async monitorOutgoingTransfers() {
        try {
            const hotWalletAddress = await this.tonHotWalletService.getAddress();
            const pendingTransfersCount = await this.dataSource
                .getRepository(TonTransferEntity)
                .createQueryBuilder('transfer')
                .where('transfer.type = :type', {
                    type: TonTransferType.PAYOUT,
                })
                .andWhere('transfer.status = :status', {
                    status: TonTransferStatus.PENDING,
                })
                .getCount();
            const limit = Math.min(
                100,
                Math.max(20, pendingTransfersCount * 5),
            );
            const transactions = await this.ton.getTransactions(
                hotWalletAddress,
                limit,
            );

            for (const entry of transactions) {
                const outMsgs = (entry as any).out_msgs ?? [];
                if (!Array.isArray(outMsgs) || outMsgs.length === 0) {
                    continue;
                }

                const txHashRaw =
                    (entry as any).transaction_id?.hash ?? (entry as any).hash;
                if (!txHashRaw) {
                    continue;
                }
                const txHash = String(txHashRaw).toLowerCase();
                const observedAt = new Date(Number((entry as any).utime) * 1000);

                for (const msg of outMsgs) {
                    if (!msg?.destination || !msg?.value) {
                        continue;
                    }
                    await this.processOutgoingTransfer({
                        txHash,
                        amountNano: String(msg.value),
                        fromAddress: hotWalletAddress,
                        toAddress: String(msg.destination),
                        observedAt,
                        raw: entry as any,
                    });
                }
            }

            await this.finalizeOutgoingTransfers();
        } catch (err) {
            this.logger.error(
                'Outgoing watcher error',
                err instanceof Error ? err.stack : String(err),
            );
        }
    }

    private async processTransfer(
        escrow: DealEscrowEntity,
        transfer: {
            txHash: string;
            amountNano: string;
            fromAddress: string;
            toAddress: string;
            observedAt: Date;
            raw: Record<string, unknown>;
        },
    ): Promise<void> {
        const shouldDeploy = await this.dataSource.transaction(
            async (manager) => {
            const transferRepo = manager.getRepository(TonTransferEntity);
            const escrowRepo = manager.getRepository(DealEscrowEntity);
            const dealRepo = manager.getRepository(DealEntity);
            const txRepo = manager.getRepository(TransactionEntity);

            const lockedEscrow = await escrowRepo.findOne({
                where: {id: escrow.id},
                lock: {mode: 'pessimistic_write'},
            });

            if (!lockedEscrow) {
                return false;
            }

            const deal = await dealRepo.findOne({
                where: {id: lockedEscrow.dealId},
                lock: {mode: 'pessimistic_write'},
            });
            if (!deal) {
                return false;
            }

            const deadline = lockedEscrow.paymentDeadlineAt;
            const isLate = Boolean(deadline && transfer.observedAt > deadline);
            if (isLate) {
                await this.dealsNotificationsService.notifyAdvertiser(
                    deal,
                    'telegram.payment.expired',
                );
            }

            const existingTx = await txRepo.findOne({
                where: {externalTxHash: transfer.txHash},
            });
            if (existingTx) {
                return false;
            }

            const currentPaid = lockedEscrow.paidNano ?? '0';
            const nextPaid = addNano(currentPaid, transfer.amountNano);
            const expected = lockedEscrow.amountNano;

            const isConfirmed = gteNano(nextPaid, expected);
            const remaining = isConfirmed ? '0' : subNano(expected, nextPaid);

            const transaction = await txRepo.save(
                txRepo.create({
                    userId: deal.advertiserUserId,
                    type: TransactionType.DEPOSIT,
                    direction: TransactionDirection.IN,
                    status: TransactionStatus.COMPLETED,
                    amountNano: transfer.amountNano,
                    currency: lockedEscrow.currency,
                    dealId: deal.id,
                    escrowId: lockedEscrow.id,
                    channelId: deal.channelId,
                    depositAddress: lockedEscrow.depositAddress,
                    externalTxHash: transfer.txHash,
                    description: 'Deposit received',
                    confirmedAt: new Date(),
                    completedAt: new Date(),
                }),
            );

            await transferRepo
                .createQueryBuilder()
                .insert()
                .values({
                    transactionId: transaction.id,
                    dealId: deal.id,
                    network: CurrencyCode.TON,
                    type: TonTransferType.DEPOSIT,
                    status: TonTransferStatus.COMPLETED,
                    toAddress: transfer.toAddress,
                    fromAddress: transfer.fromAddress,
                    amountNano: transfer.amountNano,
                    txHash: transfer.txHash,
                    observedAt: transfer.observedAt,
                    raw: isLate ? {...transfer.raw, late: true} : transfer.raw,
                    idempotencyKey: `deposit:${transfer.txHash}`,
                    errorMessage: null,
                })
                .onConflict('( \"txHash\", \"network\" ) DO NOTHING')
                .execute();

            await escrowRepo.update(lockedEscrow.id, {
                paidNano: nextPaid,
                status: isConfirmed
                    ? EscrowStatus.PAID_HELD
                    : EscrowStatus.PAID_PARTIAL,
                paidAt: lockedEscrow.paidAt ?? new Date(),
                heldAt: isConfirmed ? new Date() : lockedEscrow.heldAt,
            });

            this.logger.log(
                `[TON-WATCHER] ${JSON.stringify({
                    event: 'incoming_payment',
                    dealId: deal.id,
                    escrowId: lockedEscrow.id,
                    amountNano: transfer.amountNano,
                    paidNano: nextPaid,
                    status: isConfirmed
                        ? EscrowStatus.PAID_HELD
                        : EscrowStatus.PAID_PARTIAL,
                })}`,
            );

            await dealRepo.update(deal.id, {
                stage: isConfirmed
                    ? DealStage.POST_SCHEDULED
                    : DealStage.PAYMENT_PARTIALLY_PAID,
                status: mapStageToDealStatus(
                    isConfirmed
                        ? DealStage.POST_SCHEDULED
                        : DealStage.PAYMENT_PARTIALLY_PAID,
                ),
            });

            if (isConfirmed) {
                const updatedDeal = await dealRepo.findOne({
                    where: {id: deal.id},
                });
                if (updatedDeal) {
                    await this.dealsNotificationsService.notifyPaymentConfirmed(
                        updatedDeal,
                    );
                }
                return true;
            }

            const updatedDeal = await dealRepo.findOne({
                where: {id: deal.id},
            });
            if (updatedDeal) {
                await this.dealsNotificationsService.notifyAdvertiserPartialPayment(
                    updatedDeal,
                    nextPaid,
                    remaining,
                );
            }
            return true;
        },
        );

        if (!shouldDeploy || !escrow.depositWalletId) {
            return;
        }

        const deploymentOptions = await this.getDeploymentOptions(
            escrow.depositWalletId,
        );
        if (!deploymentOptions) {
            return;
        }

        try {
            const deployed =
                await this.tonWalletDeploymentService.ensureDeployed(
                    deploymentOptions,
                );
            if (deployed) {
                await this.reconcileDeploymentBalance(
                    escrow.id,
                    deploymentOptions.address,
                );
            }
        } catch (error) {
            this.logger.warn(
                `Failed to deploy escrow wallet ${deploymentOptions.address}: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }
    }

    private async processOutgoingTransfer(transfer: {
        txHash: string;
        amountNano: string;
        fromAddress: string;
        toAddress: string;
        observedAt: Date;
        raw: Record<string, unknown>;
    }): Promise<void> {
        let payoutUserId: string | null = null;
        await this.dataSource.transaction(async (manager) => {
            const transferRepo = manager.getRepository(TonTransferEntity);
            const txRepo = manager.getRepository(TransactionEntity);

            let tonTransfer = await transferRepo.findOne({
                where: {txHash: transfer.txHash},
            });

            if (!tonTransfer) {
                const normalizedToAddress = this.normalizeAddress(transfer.toAddress);
                const observedAtMs = transfer.observedAt.getTime();
                const candidatePayouts = await txRepo
                    .createQueryBuilder('tx')
                    .where('tx.type = :type', {
                        type: TransactionType.PAYOUT,
                    })
                    .andWhere('tx.direction = :direction', {
                        direction: TransactionDirection.OUT,
                    })
                    .andWhere('tx.status = :status', {
                        status: TransactionStatus.AWAITING_CONFIRMATION,
                    })
                    .andWhere('tx.createdAt >= :from', {
                        from: new Date(observedAtMs - 24 * 60 * 60 * 1000),
                    })
                    .orderBy('tx.createdAt', 'DESC')
                    .getMany();

                const payout = candidatePayouts.find((candidate) => {
                    if (!candidate.destinationAddress) {
                        return false;
                    }
                    return (
                        this.normalizeAddress(candidate.destinationAddress) ===
                        normalizedToAddress
                    );
                });

                if (payout) {
                    if (payout.tonTransferId) {
                        tonTransfer = await transferRepo.findOne({
                            where: {id: payout.tonTransferId},
                        });
                    } else {
                        tonTransfer = await transferRepo.findOne({
                            where: {transactionId: payout.id},
                        });
                    }
                }
            }

            if (!tonTransfer) {
                return;
            }

            if (tonTransfer.status !== TonTransferStatus.PENDING) {
                return;
            }

            await transferRepo.update(tonTransfer.id, {
                status: TonTransferStatus.CONFIRMED,
                txHash: tonTransfer.txHash ?? transfer.txHash,
                observedAt: transfer.observedAt,
                raw: transfer.raw,
                errorMessage: null,
            });

            if (tonTransfer.transactionId) {
                const transaction = await txRepo.findOne({
                    where: {id: tonTransfer.transactionId},
                });
                if (transaction) {
                    try {
                        ensureTransitionAllowed(
                            transaction.status,
                            TransactionStatus.CONFIRMED,
                        );
                    } catch (error) {
                        this.logger.warn(
                            `Skip invalid payout transition`,
                            JSON.stringify({
                                transactionId: transaction.id,
                                from: transaction.status,
                                to: TransactionStatus.CONFIRMED,
                                error:
                                    error instanceof Error
                                        ? error.message
                                        : String(error),
                            }),
                        );
                        return;
                    }
                    await txRepo.update(tonTransfer.transactionId, {
                        status: TransactionStatus.CONFIRMED,
                        confirmedAt: new Date(),
                        externalTxHash: tonTransfer.txHash ?? transfer.txHash,
                    });
                    if (
                        transaction.type === TransactionType.PAYOUT &&
                        transaction.direction === TransactionDirection.OUT
                    ) {
                        payoutUserId = transaction.userId;
                    }
                }
            }

            this.logger.log(
                `[TON-WATCHER] ${JSON.stringify({
                    event: 'outgoing_confirmed',
                    tonTransferId: tonTransfer.id,
                    transactionId: tonTransfer.transactionId,
                    txHash: transfer.txHash,
                    amountNano: transfer.amountNano,
                })}`,
            );
        });
        if (payoutUserId) {
            await this.notifyPayoutConfirmed(payoutUserId);
        }
    }

    private normalizeAddress(address: string): string {
        try {
            return Address.parse(address).toRawString();
        } catch (error) {
            return address.trim().toLowerCase();
        }
    }

    private async notifyPayoutConfirmed(userId: string): Promise<void> {
        const user = await this.userRepository.findOne({
            where: {id: userId},
        });
        if (!user?.telegramId) {
            return;
        }
        await this.telegramMessengerService.sendText(
            user.telegramId,
            'telegram.payment.payout_confirmed',
        );
    }

    private async finalizeOutgoingTransfers(): Promise<void> {
        const confirmationSeconds =
            Number(process.env.TON_FINALITY_SECONDS ?? '120');
        const timeoutSeconds =
            Number(process.env.TON_TRANSFER_TIMEOUT_SECONDS ?? '1800');
        const now = Date.now();

        const pendingTransfers = await this.dataSource
            .getRepository(TonTransferEntity)
            .createQueryBuilder('transfer')
            .where('transfer.type = :type', {
                type: TonTransferType.PAYOUT,
            })
            .andWhere('transfer.status IN (:...statuses)', {
                statuses: [
                    TonTransferStatus.PENDING,
                    TonTransferStatus.CONFIRMED,
                ],
            })
            .getMany();

        for (const transfer of pendingTransfers) {
            if (transfer.status === TonTransferStatus.CONFIRMED) {
                const observedAt = transfer.observedAt?.getTime();
                if (
                    observedAt &&
                    now - observedAt >= confirmationSeconds * 1000
                ) {
                    let feeTransferContext:
                        | {
                              payoutId: string;
                              currency: CurrencyCode;
                              amountNano: bigint;
                          }
                        | null = null;
                    await this.dataSource.transaction(async (manager) => {
                        const transferRepo = manager.getRepository(TonTransferEntity);
                        const txRepo = manager.getRepository(TransactionEntity);

                        await transferRepo.update(transfer.id, {
                            status: TonTransferStatus.COMPLETED,
                            errorMessage: null,
                        });

                        if (transfer.transactionId) {
                            const transaction = await txRepo.findOne({
                                where: {id: transfer.transactionId},
                            });
                            if (transaction) {
                                try {
                                    ensureTransitionAllowed(
                                        transaction.status,
                                        TransactionStatus.COMPLETED,
                                    );
                                } catch (error) {
                                    this.logger.warn(
                                        `Skip invalid payout transition`,
                                        JSON.stringify({
                                            transactionId: transaction.id,
                                            from: transaction.status,
                                            to: TransactionStatus.COMPLETED,
                                            error:
                                                error instanceof Error
                                                    ? error.message
                                                    : String(error),
                                        }),
                                    );
                                    return;
                                }
                                await txRepo.update(transfer.transactionId, {
                                    status: TransactionStatus.COMPLETED,
                                    completedAt: new Date(),
                                });
                                await this.ledgerService.updateFeeTransactionsStatus(
                                    transfer.transactionId,
                                    TransactionStatus.COMPLETED,
                                    manager,
                                );
                                const serviceFee = BigInt(
                                    transaction.serviceFeeNano ?? '0',
                                );
                                const networkFee = BigInt(
                                    transaction.networkFeeNano ?? '0',
                                );
                                const totalFee = serviceFee + networkFee;
                                if (totalFee > 0n) {
                                    feeTransferContext = {
                                        payoutId: transaction.id,
                                        currency: transaction.currency,
                                        amountNano: totalFee,
                                    };
                                }
                            }
                        }
                    });

                    this.logger.log(
                        `[TON-WATCHER] ${JSON.stringify({
                            event: 'outgoing_completed',
                            tonTransferId: transfer.id,
                            transactionId: transfer.transactionId,
                        })}`,
                    );
                    if (feeTransferContext) {
                        await this.sendFeeRevenueTransfer(feeTransferContext);
                    }
                }
                continue;
            }

            const createdAt = transfer.createdAt.getTime();
            if (now - createdAt >= timeoutSeconds * 1000) {
                await this.dataSource.transaction(async (manager) => {
                    const transferRepo = manager.getRepository(TonTransferEntity);
                    const txRepo = manager.getRepository(TransactionEntity);

                    await transferRepo.update(transfer.id, {
                        status: TonTransferStatus.FAILED,
                        errorMessage: 'Transfer timeout',
                    });

                    if (transfer.transactionId) {
                        const transaction = await txRepo.findOne({
                            where: {id: transfer.transactionId},
                        });
                        if (transaction) {
                            try {
                                ensureTransitionAllowed(
                                    transaction.status,
                                    TransactionStatus.FAILED,
                                );
                            } catch (error) {
                                this.logger.warn(
                                    `Skip invalid payout transition`,
                                    JSON.stringify({
                                        transactionId: transaction.id,
                                        from: transaction.status,
                                        to: TransactionStatus.FAILED,
                                        error:
                                            error instanceof Error
                                                ? error.message
                                                : String(error),
                                    }),
                                );
                                return;
                            }
                            await txRepo.update(transfer.transactionId, {
                                status: TransactionStatus.FAILED,
                                errorCode: 'TRANSFER_TIMEOUT',
                                errorMessage: 'Transfer timeout',
                            });
                            await this.ledgerService.updateFeeTransactionsStatus(
                                transfer.transactionId,
                                TransactionStatus.CANCELED,
                                manager,
                            );
                        }
                    }
                });

                this.logger.warn(
                    `[TON-WATCHER] ${JSON.stringify({
                        event: 'outgoing_failed',
                        tonTransferId: transfer.id,
                        transactionId: transfer.transactionId,
                        reason: 'timeout',
                    })}`,
                );
            }
        }
    }

    private async sendFeeRevenueTransfer(options: {
        payoutId: string;
        currency: CurrencyCode;
        amountNano: bigint;
    }): Promise<void> {
        const config = await this.feesConfigService.getConfig();
        if (!config.feesEnabled) {
            return;
        }
        if (config.feeRevenueStrategy !== 'LEDGER_AND_TRANSFER') {
            return;
        }
        if (!config.feeRevenueAddress) {
            this.logger.warn(
                `[TON-WATCHER] Fee transfer skipped: FEE_REVENUE_ADDRESS missing`,
            );
            return;
        }
        if (options.amountNano <= 0n) {
            return;
        }

        const transferRepo = this.dataSource.getRepository(TonTransferEntity);
        const idempotencyKey = `fee:${options.payoutId}`;
        let transfer = await transferRepo.findOne({
            where: {idempotencyKey},
        });

        if (transfer && transfer.status !== TonTransferStatus.FAILED) {
            return;
        }

        const fromAddress = await this.tonHotWalletService.getAddress();
        if (!transfer) {
            transfer = await transferRepo.save(
                transferRepo.create({
                    transactionId: null,
                    dealId: null,
                    escrowWalletId: null,
                    idempotencyKey,
                    type: TonTransferType.FEE,
                    status: TonTransferStatus.PENDING,
                    network: options.currency,
                    fromAddress,
                    toAddress: config.feeRevenueAddress,
                    amountNano: options.amountNano.toString(),
                    txHash: null,
                    observedAt: new Date(),
                    raw: {reason: 'fee_revenue', payoutId: options.payoutId},
                    errorMessage: null,
                }),
            );
        } else {
            await transferRepo.update(transfer.id, {
                status: TonTransferStatus.PENDING,
                errorMessage: null,
            });
        }

        try {
            await this.tonHotWalletService.sendTon({
                toAddress: config.feeRevenueAddress,
                amountNano: options.amountNano,
            });
            await transferRepo.update(transfer.id, {
                status: TonTransferStatus.COMPLETED,
                observedAt: new Date(),
                errorMessage: null,
            });
            this.logger.log(
                `[TON-WATCHER] ${JSON.stringify({
                    event: 'fee_revenue_sent',
                    payoutId: options.payoutId,
                    tonTransferId: transfer.id,
                    amountNano: options.amountNano.toString(),
                    toAddress: config.feeRevenueAddress,
                })}`,
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await transferRepo.update(transfer.id, {
                status: TonTransferStatus.FAILED,
                errorMessage: message,
            });
            this.logger.warn(
                `[TON-WATCHER] ${JSON.stringify({
                    event: 'fee_revenue_failed',
                    payoutId: options.payoutId,
                    tonTransferId: transfer.id,
                    error: message,
                })}`,
            );
        }
    }

    private async reconcileDeploymentBalance(
        escrowId: string,
        address: string,
    ): Promise<void> {
        let balanceNano: bigint;
        try {
            balanceNano = await this.tonWalletDeploymentService.getBalance(
                address,
            );
        } catch (error) {
            this.logger.warn(
                `Failed to fetch escrow wallet balance ${address}: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
            return;
        }

        await this.dataSource.transaction(async (manager) => {
            const escrowRepo = manager.getRepository(DealEscrowEntity);
            const dealRepo = manager.getRepository(DealEntity);

            const lockedEscrow = await escrowRepo.findOne({
                where: {id: escrowId},
                lock: {mode: 'pessimistic_write'},
            });

            if (
                !lockedEscrow ||
                ![
                    EscrowStatus.AWAITING_PAYMENT,
                    EscrowStatus.PAID_PARTIAL,
                    EscrowStatus.PAID_HELD,
                ].includes(lockedEscrow.status)
            ) {
                return;
            }

            const currentPaid = lockedEscrow.paidNano ?? '0';
            if (balanceNano >= BigInt(currentPaid)) {
                return;
            }

            const balanceStr = balanceNano.toString();
            const expected = lockedEscrow.amountNano;
            const isConfirmed = gteNano(balanceStr, expected);

            await escrowRepo.update(lockedEscrow.id, {
                paidNano: balanceStr,
                status: isConfirmed
                    ? EscrowStatus.PAID_HELD
                    : EscrowStatus.PAID_PARTIAL,
                paidAt: lockedEscrow.paidAt ?? new Date(),
                heldAt: isConfirmed ? lockedEscrow.heldAt ?? new Date() : null,
            });

            if (!isConfirmed) {
                await dealRepo.update(lockedEscrow.dealId, {
                    stage: DealStage.PAYMENT_PARTIALLY_PAID,
                    status: mapStageToDealStatus(
                        DealStage.PAYMENT_PARTIALLY_PAID,
                    ),
                });
            }
        });
    }

    private async getDeploymentOptions(
        walletId: string,
    ): Promise<{publicKeyHex: string; secretKeyHex: string; address: string} | null> {
        const wallet = await this.escrowWalletRepo.findOne({where: {id: walletId}});
        if (!wallet) {
            return null;
        }

        const walletKey = await this.escrowWalletKeyRepo.findOne({
            where: {walletId},
        });
        if (!walletKey) {
            return null;
        }

        const decrypted = this.keyEncryptionService.decryptSecret(
            walletKey.encryptedSecret,
        );
        const secret = JSON.parse(decrypted) as {
            publicKeyHex?: string;
            secretKeyHex?: string;
            address?: string;
        };

        if (!secret.publicKeyHex || !secret.secretKeyHex || !secret.address) {
            return null;
        }

        if (secret.address !== wallet.address) {
            return null;
        }

        return {
            publicKeyHex: secret.publicKeyHex,
            secretKeyHex: secret.secretKeyHex,
            address: wallet.address,
        };
    }

}
