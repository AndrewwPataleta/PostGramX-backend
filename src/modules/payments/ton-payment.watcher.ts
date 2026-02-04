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
import {TonCenterClient} from './ton/toncenter.client';
import {addNano, gteNano, subNano} from './utils/bigint';
import {CurrencyCode} from '../../common/constants/currency/currency.constants';
import {KeyEncryptionService} from './wallets/crypto/key-encryption.service';
import {TonWalletDeploymentService} from './ton/ton-wallet-deployment.service';

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
    ) {}

    @Cron('*/15 * * * * *')
    async monitorIncomingPayments() {
        try {

            const escrows = await this.escrowRepo.find({
                where: {
                    status: In([
                        EscrowStatus.AWAITING_PAYMENT,
                        EscrowStatus.PARTIALLY_PAID,
                    ]),
                },
                take: 20,
            });

            if (!escrows.length) {
                return;
            }

            for (const escrow of escrows) {
                if (!escrow.paymentAddress) {
                    continue;
                }

                const transactions = await this.ton.getTransactions(
                    escrow.paymentAddress,
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
                    console.log(inMsg)
                    await this.processTransfer(escrow, {
                        txHash,
                        amountNano,
                        fromAddress: inMsg.source ?? 'unknown',
                        toAddress: escrow.paymentAddress,
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

    @Cron('*/15 * * * * *')
    async monitorWithdrawals() {
        try {
            const withdrawals = await this.txRepo.find({
                where: {
                    type: TransactionType.WITHDRAW,
                    status: In([TransactionStatus.AWAITING_CONFIRMATION]),
                },
                take: 20,
            });

            for (const withdrawal of withdrawals) {
                const metadata = withdrawal.metadata as
                    | {destinationAddress?: string; sourceAddress?: string}
                    | null;
                const destinationAddress = metadata?.destinationAddress;
                const sourceAddress = metadata?.sourceAddress;

                if (!destinationAddress || !sourceAddress) {
                    continue;
                }

                const transactions = await this.ton.getTransactions(
                    sourceAddress,
                    10,
                );

                for (const entry of transactions) {
                    const outMsgs = (entry as any).out_msgs;
                    if (!Array.isArray(outMsgs) || outMsgs.length === 0) {
                        continue;
                    }

                    const txHashRaw =
                        (entry as any).transaction_id?.hash ?? (entry as any).hash;
                    if (!txHashRaw) {
                        continue;
                    }

                    const observedAt = new Date(
                        Number((entry as any).utime) * 1000,
                    );
                    const txHash = String(txHashRaw).toLowerCase();

                    for (const outMsg of outMsgs) {
                        const outValue = outMsg?.value;
                        const outDestination = outMsg?.destination;
                        if (!outValue || !outDestination) {
                            continue;
                        }

                        if (
                            String(outDestination).toLowerCase() !==
                            destinationAddress.toLowerCase()
                        ) {
                            continue;
                        }

                        if (String(outValue) !== withdrawal.amountNano) {
                            continue;
                        }

                        await this.processWithdrawalTransfer(withdrawal, {
                            txHash,
                            amountNano: String(outValue),
                            fromAddress: sourceAddress,
                            toAddress: destinationAddress,
                            observedAt,
                            raw: entry as any,
                        });
                        break;
                    }
                }
            }
        } catch (err) {
            this.logger.error(
                'Withdrawal watcher error',
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
            const txRepo = manager.getRepository(TransactionEntity);
            const escrowRepo = manager.getRepository(DealEscrowEntity);
            const dealRepo = manager.getRepository(DealEntity);

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

            const transaction = await txRepo.findOne({
                where: {escrowId: lockedEscrow.id, type: TransactionType.ESCROW_HOLD},
                lock: {mode: 'pessimistic_write'},
            });

            if (!transaction) {
                return false;
            }

            const insertResult = await transferRepo
                .createQueryBuilder()
                .insert()
                .values({
                    transactionId: transaction.id,
                    network: CurrencyCode.TON,
                    toAddress: transfer.toAddress,
                    fromAddress: transfer.fromAddress,
                    amountNano: transfer.amountNano,
                    txHash: transfer.txHash,
                    observedAt: transfer.observedAt,
                    raw: transfer.raw,
                })
                .onConflict('( \"txHash\", \"network\" ) DO NOTHING')
                .execute();

            const inserted = Boolean(insertResult.identifiers?.length);
            if (!inserted) {
                return false;
            }

            const deadline = lockedEscrow.paymentDeadlineAt;
            if (deadline && transfer.observedAt > deadline) {
                await transferRepo.update(
                    {txHash: transfer.txHash, network: CurrencyCode.TON},
                    {raw: {...transfer.raw, late: true}},
                );
                await this.dealsNotificationsService.notifyAdvertiser(
                    deal,
                    'telegram.payment.expired',
                );
                return false;
            }

            const currentPaid = lockedEscrow.paidNano ?? '0';
            const nextPaid = addNano(currentPaid, transfer.amountNano);
            const expected = lockedEscrow.amountNano;

            const isConfirmed = gteNano(nextPaid, expected);
            const remaining = isConfirmed ? '0' : subNano(expected, nextPaid);

            await escrowRepo.update(lockedEscrow.id, {
                paidNano: nextPaid,
                status: isConfirmed
                    ? EscrowStatus.PAID_CONFIRMED
                    : EscrowStatus.PARTIALLY_PAID,
                confirmedAt: isConfirmed ? new Date() : lockedEscrow.confirmedAt,
            });

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

            await txRepo.update(transaction.id, {
                receivedNano: nextPaid,
                status: isConfirmed
                    ? TransactionStatus.CONFIRMED
                    : TransactionStatus.PARTIAL,
                confirmedAt: isConfirmed
                    ? transaction.confirmedAt ?? new Date()
                    : transaction.confirmedAt,
                externalTxHash: isConfirmed ? transfer.txHash : transaction.externalTxHash,
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

        if (!shouldDeploy || !escrow.walletId) {
            return;
        }

        const deploymentOptions = await this.getDeploymentOptions(escrow.walletId);
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
            const txRepo = manager.getRepository(TransactionEntity);

            const lockedEscrow = await escrowRepo.findOne({
                where: {id: escrowId},
                lock: {mode: 'pessimistic_write'},
            });

            if (
                !lockedEscrow ||
                ![
                    EscrowStatus.AWAITING_PAYMENT,
                    EscrowStatus.PARTIALLY_PAID,
                    EscrowStatus.PAID_CONFIRMED,
                ].includes(lockedEscrow.status)
            ) {
                return;
            }

            const transaction = await txRepo.findOne({
                where: {
                    escrowId: lockedEscrow.id,
                    type: TransactionType.ESCROW_HOLD,
                },
                lock: {mode: 'pessimistic_write'},
            });

            if (!transaction) {
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
                    ? EscrowStatus.PAID_CONFIRMED
                    : EscrowStatus.PARTIALLY_PAID,
                confirmedAt: isConfirmed
                    ? lockedEscrow.confirmedAt ?? new Date()
                    : null,
            });

            await txRepo.update(transaction.id, {
                receivedNano: balanceStr,
                status: isConfirmed
                    ? TransactionStatus.CONFIRMED
                    : TransactionStatus.PARTIAL,
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

    private async processWithdrawalTransfer(
        withdrawal: TransactionEntity,
        transfer: {
            txHash: string;
            amountNano: string;
            fromAddress: string;
            toAddress: string;
            observedAt: Date;
            raw: Record<string, unknown>;
        },
    ): Promise<void> {
        await this.dataSource.transaction(async (manager) => {
            const transferRepo = manager.getRepository(TonTransferEntity);
            const txRepo = manager.getRepository(TransactionEntity);

            const lockedTx = await txRepo.findOne({
                where: {id: withdrawal.id},
                lock: {mode: 'pessimistic_write'},
            });

            if (!lockedTx) {
                return;
            }

            if (lockedTx.status !== TransactionStatus.AWAITING_CONFIRMATION) {
                return;
            }

            const insertResult = await transferRepo
                .createQueryBuilder()
                .insert()
                .values({
                    transactionId: lockedTx.id,
                    network: CurrencyCode.TON,
                    toAddress: transfer.toAddress,
                    fromAddress: transfer.fromAddress,
                    amountNano: transfer.amountNano,
                    txHash: transfer.txHash,
                    observedAt: transfer.observedAt,
                    raw: transfer.raw,
                })
                .onConflict('( \"txHash\", \"network\" ) DO NOTHING')
                .execute();

            const inserted = Boolean(insertResult.identifiers?.length);
            if (!inserted) {
                return;
            }

            await txRepo.update(lockedTx.id, {
                status: TransactionStatus.COMPLETED,
                externalTxHash: transfer.txHash,
                completedAt: new Date(),
            });
        });
    }
}
