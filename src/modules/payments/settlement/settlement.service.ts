import {Injectable, Logger} from '@nestjs/common';
import {Cron} from '@nestjs/schedule';
import {InjectRepository} from '@nestjs/typeorm';
import {DataSource, In, Repository} from 'typeorm';
import {DealEscrowEntity} from '../../deals/entities/deal-escrow.entity';
import {DealPublicationEntity} from '../../deals/entities/deal-publication.entity';
import {DealEntity} from '../../deals/entities/deal.entity';
import {EscrowStatus} from '../../../common/constants/deals/deal-escrow-status.constants';
import {PublicationStatus} from '../../../common/constants/deals/publication-status.constants';
import {DealStatus} from '../../../common/constants/deals/deal-status.constants';
import {PayoutRequestEntity} from '../entities/payout-request.entity';
import {RefundRequestEntity} from '../entities/refund-request.entity';
import {RequestStatus} from '../../../common/constants/payments/request-status.constants';
import {UserWalletEntity} from '../entities/user-wallet.entity';
import {TransactionEntity} from '../entities/transaction.entity';
import {TransactionType} from '../../../common/constants/payments/transaction-type.constants';
import {TransactionDirection} from '../../../common/constants/payments/transaction-direction.constants';
import {TransactionStatus} from '../../../common/constants/payments/transaction-status.constants';
import {SETTLEMENT_CRON} from '../../../config/payments.config';
import {TonHotWalletService} from '../ton/ton-hot-wallet.service';
import {TelegramPermissionsService} from '../../telegram/telegram-permissions.service';

@Injectable()
export class SettlementService {
    private readonly logger = new Logger(SettlementService.name);

    constructor(
        private readonly dataSource: DataSource,
        @InjectRepository(DealEscrowEntity)
        private readonly escrowRepository: Repository<DealEscrowEntity>,

        @InjectRepository(DealEntity)
        private readonly dealRepository: Repository<DealEntity>,
        @InjectRepository(PayoutRequestEntity)
        private readonly payoutRepository: Repository<PayoutRequestEntity>,
        @InjectRepository(RefundRequestEntity)
        private readonly refundRepository: Repository<RefundRequestEntity>,
        @InjectRepository(UserWalletEntity)
        private readonly userWalletRepository: Repository<UserWalletEntity>,
        @InjectRepository(TransactionEntity)
        private readonly transactionRepository: Repository<TransactionEntity>,
        private readonly tonHotWalletService: TonHotWalletService,
        private readonly telegramPermissionsService: TelegramPermissionsService,
    ) {}

    @Cron(SETTLEMENT_CRON)
    async handleSettlement(): Promise<void> {
        await this.queueEligiblePayouts();
        await this.processPayouts();
        await this.queueEligibleRefunds();
        await this.processRefunds();
    }

    private async queueEligiblePayouts(): Promise<void> {
        const escrows = await this.escrowRepository
            .createQueryBuilder('escrow')
            .innerJoin(
                DealPublicationEntity,
                'publication',
                'publication.dealId = escrow.dealId',
            )
            .where('escrow.status = :status', {status: EscrowStatus.PAID_HELD})
            .andWhere('escrow.payoutId IS NULL')
            .andWhere('publication.status = :pubStatus', {
                pubStatus: PublicationStatus.VERIFIED,
            })
            .orderBy('escrow.updatedAt', 'ASC')
            .take(20)
            .getMany();

        for (const escrow of escrows) {
            await this.dataSource.transaction(async (manager) => {
                const escrowRepo = manager.getRepository(DealEscrowEntity);
                const payoutRepo = manager.getRepository(PayoutRequestEntity);
                const dealRepo = manager.getRepository(DealEntity);
                const publicationRepo = manager.getRepository(DealPublicationEntity);
                const transactionRepo = manager.getRepository(TransactionEntity);

                const lockedEscrow = await escrowRepo.findOne({
                    where: {id: escrow.id},
                    lock: {mode: 'pessimistic_write'},
                });
                if (
                    !lockedEscrow ||
                    lockedEscrow.status !== EscrowStatus.PAID_HELD ||
                    lockedEscrow.payoutId
                ) {
                    return;
                }

                const publication = await publicationRepo.findOne({
                    where: {dealId: lockedEscrow.dealId},
                });
                if (!publication || publication.status !== PublicationStatus.VERIFIED) {
                    return;
                }

                const deal = await dealRepo.findOne({
                    where: {id: lockedEscrow.dealId},
                });
                if (!deal?.publisherUserId) {
                    return;
                }

                const idempotencyKey = `payout:${deal.id}:${lockedEscrow.amountNano}:${lockedEscrow.currency}`;
                let payout = await payoutRepo.findOne({
                    where: {idempotencyKey},
                });

                if (!payout) {
                    payout = payoutRepo.create({
                        userId: deal.publisherUserId,
                        dealId: deal.id,
                        amountNano: lockedEscrow.amountNano,
                        currency: lockedEscrow.currency,
                        status: RequestStatus.CREATED,
                        idempotencyKey,
                    });
                    payout = await payoutRepo.save(payout);
                }

                const releaseKey = `escrow_release:${lockedEscrow.id}`;
                const existingRelease = await transactionRepo.findOne({
                    where: {idempotencyKey: releaseKey},
                });
                if (!existingRelease) {
                    await transactionRepo.save(
                        transactionRepo.create({
                            userId: deal.publisherUserId,
                            type: TransactionType.PAYOUT,
                            direction: TransactionDirection.IN,
                            status: TransactionStatus.COMPLETED,
                            amountNano: lockedEscrow.amountNano,
                            currency: lockedEscrow.currency,
                            dealId: deal.id,
                            escrowId: lockedEscrow.id,
                            channelId: deal.channelId,
                            description: 'Escrow release',
                            idempotencyKey: releaseKey,
                            confirmedAt: new Date(),
                            completedAt: new Date(),
                        }),
                    );
                }

                await escrowRepo.update(lockedEscrow.id, {
                    status: EscrowStatus.PAYOUT_PENDING,
                    payoutId: payout.id,
                });
            });

            this.logger.log(`Payout queued for escrow ${escrow.id}`);
        }
    }

    private async processPayouts(): Promise<void> {
        const payouts = await this.payoutRepository.find({
            where: {
                status: In([RequestStatus.CREATED, RequestStatus.FAILED]),
            },
            take: 20,
        });

        for (const payout of payouts) {
            await this.dataSource.transaction(async (manager) => {
                const payoutRepo = manager.getRepository(PayoutRequestEntity);
                const escrowRepo = manager.getRepository(DealEscrowEntity);
                const walletRepo = manager.getRepository(UserWalletEntity);
                const transactionRepo = manager.getRepository(TransactionEntity);

                const lockedPayout = await payoutRepo.findOne({
                    where: {id: payout.id},
                    lock: {mode: 'pessimistic_write'},
                });
                if (
                    !lockedPayout ||
                    ![RequestStatus.CREATED, RequestStatus.FAILED].includes(
                        lockedPayout.status,
                    )
                ) {
                    return;
                }

                lockedPayout.status = RequestStatus.PROCESSING;
                lockedPayout.attemptCount += 1;
                await payoutRepo.save(lockedPayout);

                const wallet = await walletRepo.findOne({
                    where: {userId: lockedPayout.userId, isActive: true},
                });
                if (!wallet) {
                    await payoutRepo.update(lockedPayout.id, {
                        status: RequestStatus.FAILED,
                        errorMessage: 'User wallet not set',
                    });
                    this.logger.warn(
                        `Payout failed for deal ${lockedPayout.dealId}: wallet not set`,
                    );
                    return;
                }

                const permissionsOk = await this.ensurePayoutPermissions(
                    lockedPayout.dealId,
                    lockedPayout.userId,
                );
                if (!permissionsOk) {
                    await payoutRepo.update(lockedPayout.id, {
                        status: RequestStatus.FAILED,
                        errorMessage: 'Permission check failed',
                    });
                    this.logger.warn(
                        `Payout failed for deal ${lockedPayout.dealId}: permission check failed`,
                    );
                    return;
                }

                try {
                    const amountNano = BigInt(lockedPayout.amountNano);
                    const {txHash} = await this.tonHotWalletService.sendTon({
                        toAddress: wallet.tonAddress,
                        amountNano,
                    });

                    await payoutRepo.update(lockedPayout.id, {
                        status: RequestStatus.SENT,
                        txHash,
                        errorMessage: null,
                    });

                    await transactionRepo.save(
                        transactionRepo.create({
                            userId: lockedPayout.userId,
                            type: TransactionType.PAYOUT,
                            direction: TransactionDirection.OUT,
                            status: TransactionStatus.COMPLETED,
                            amountNano: lockedPayout.amountNano,
                            currency: lockedPayout.currency,
                            dealId: lockedPayout.dealId,
                            description: 'Payout sent',
                            externalTxHash: txHash,
                        }),
                    );

                    await escrowRepo.update(
                        {dealId: lockedPayout.dealId},
                        {
                            status: EscrowStatus.PAID_OUT,
                            paidOutAt: new Date(),
                        },
                    );

                    this.logger.log(`Payout sent for deal ${lockedPayout.dealId}`);
                } catch (error) {
                    await payoutRepo.update(lockedPayout.id, {
                        status: RequestStatus.FAILED,
                        errorMessage:
                            error instanceof Error ? error.message : String(error),
                    });
                    this.logger.warn(
                        `Payout failed for deal ${lockedPayout.dealId}: ${
                            error instanceof Error ? error.message : String(error)
                        }`,
                    );
                }
            });
        }
    }

    private async queueEligibleRefunds(): Promise<void> {
        const escrows = await this.escrowRepository
            .createQueryBuilder('escrow')
            .innerJoin(DealEntity, 'deal', 'deal.id = escrow.dealId')
            .where('escrow.status IN (:...statuses)', {
                statuses: [
                    EscrowStatus.PAID_PARTIAL,
                    EscrowStatus.PAID_HELD,
                    EscrowStatus.REFUND_PENDING,
                ],
            })
            .andWhere('escrow.refundId IS NULL')
            .andWhere('deal.status = :status', {status: DealStatus.CANCELED})
            .orderBy('escrow.updatedAt', 'ASC')
            .take(20)
            .getMany();

        for (const escrow of escrows) {
            await this.dataSource.transaction(async (manager) => {
                const escrowRepo = manager.getRepository(DealEscrowEntity);
                const refundRepo = manager.getRepository(RefundRequestEntity);
                const dealRepo = manager.getRepository(DealEntity);

                const lockedEscrow = await escrowRepo.findOne({
                    where: {id: escrow.id},
                    lock: {mode: 'pessimistic_write'},
                });
                if (
                    !lockedEscrow ||
                    ![
                        EscrowStatus.PAID_PARTIAL,
                        EscrowStatus.PAID_HELD,
                        EscrowStatus.REFUND_PENDING,
                    ].includes(lockedEscrow.status) ||
                    lockedEscrow.refundId
                ) {
                    return;
                }

                const deal = await dealRepo.findOne({
                    where: {id: lockedEscrow.dealId},
                });
                if (!deal) {
                    return;
                }

                const paidNano = BigInt(lockedEscrow.paidNano ?? '0');
                const amountNano =
                    paidNano > 0n ? paidNano.toString() : lockedEscrow.amountNano;
                const idempotencyKey = `refund:${deal.id}:${amountNano}:${lockedEscrow.currency}`;
                let refund = await refundRepo.findOne({where: {idempotencyKey}});
                if (!refund) {
                    refund = refundRepo.create({
                        userId: deal.advertiserUserId,
                        dealId: deal.id,
                        amountNano,
                        currency: lockedEscrow.currency,
                        status: RequestStatus.CREATED,
                        idempotencyKey,
                    });
                    refund = await refundRepo.save(refund);
                }

                await escrowRepo.update(lockedEscrow.id, {
                    status: EscrowStatus.REFUND_PENDING,
                    refundId: refund.id,
                });
            });

            this.logger.log(`Refund queued for escrow ${escrow.id}`);
        }
    }

    private async processRefunds(): Promise<void> {
        const refunds = await this.refundRepository.find({
            where: {
                status: In([RequestStatus.CREATED, RequestStatus.FAILED]),
            },
            take: 20,
        });

        for (const refund of refunds) {
            await this.dataSource.transaction(async (manager) => {
                const refundRepo = manager.getRepository(RefundRequestEntity);
                const escrowRepo = manager.getRepository(DealEscrowEntity);
                const walletRepo = manager.getRepository(UserWalletEntity);
                const transactionRepo = manager.getRepository(TransactionEntity);

                const lockedRefund = await refundRepo.findOne({
                    where: {id: refund.id},
                    lock: {mode: 'pessimistic_write'},
                });
                if (
                    !lockedRefund ||
                    ![RequestStatus.CREATED, RequestStatus.FAILED].includes(
                        lockedRefund.status,
                    )
                ) {
                    return;
                }

                lockedRefund.status = RequestStatus.PROCESSING;
                lockedRefund.attemptCount += 1;
                await refundRepo.save(lockedRefund);

                const wallet = await walletRepo.findOne({
                    where: {userId: lockedRefund.userId, isActive: true},
                });
                if (!wallet) {
                    await refundRepo.update(lockedRefund.id, {
                        status: RequestStatus.FAILED,
                        errorMessage: 'User wallet not set',
                    });
                    this.logger.warn(
                        `Refund failed for deal ${lockedRefund.dealId}: wallet not set`,
                    );
                    return;
                }

                try {
                    const amountNano = BigInt(lockedRefund.amountNano);
                    const {txHash} = await this.tonHotWalletService.sendTon({
                        toAddress: wallet.tonAddress,
                        amountNano,
                    });

                    await refundRepo.update(lockedRefund.id, {
                        status: RequestStatus.SENT,
                        txHash,
                        errorMessage: null,
                    });

                    await transactionRepo.save(
                        transactionRepo.create({
                            userId: lockedRefund.userId,
                            type: TransactionType.REFUND,
                            direction: TransactionDirection.OUT,
                            status: TransactionStatus.COMPLETED,
                            amountNano: lockedRefund.amountNano,
                            currency: lockedRefund.currency,
                            dealId: lockedRefund.dealId,
                            description: 'Refund sent',
                            externalTxHash: txHash,
                        }),
                    );

                    await escrowRepo.update(
                        {dealId: lockedRefund.dealId},
                        {
                            status: EscrowStatus.REFUNDED,
                            refundedAt: new Date(),
                        },
                    );

                    this.logger.log(`Refund sent for deal ${lockedRefund.dealId}`);
                } catch (error) {
                    await refundRepo.update(lockedRefund.id, {
                        status: RequestStatus.FAILED,
                        errorMessage:
                            error instanceof Error ? error.message : String(error),
                    });
                    this.logger.warn(
                        `Refund failed for deal ${lockedRefund.dealId}: ${
                            error instanceof Error ? error.message : String(error)
                        }`,
                    );
                }
            });
        }
    }

    private async ensurePayoutPermissions(
        dealId: string,
        publisherUserId: string,
    ): Promise<boolean> {
        const deal = await this.dealRepository.findOne({where: {id: dealId}});
        if (!deal?.channelId) {
            return false;
        }

        const botCheck = await this.telegramPermissionsService.checkBotIsAdmin(
            deal.channelId,
        );
        if (!botCheck.ok) {
            return false;
        }

        const userCheck =
            await this.telegramPermissionsService.checkUserIsAdmin(
                publisherUserId,
                deal.channelId,
            );
        return userCheck.ok;
    }
}
