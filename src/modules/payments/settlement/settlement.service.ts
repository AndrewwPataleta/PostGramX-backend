import {Injectable, Logger} from '@nestjs/common';
import {Cron} from '@nestjs/schedule';
import {InjectRepository} from '@nestjs/typeorm';
import {DataSource, Repository} from 'typeorm';
import {DealEscrowEntity} from '../../deals/entities/deal-escrow.entity';
import {DealPublicationEntity} from '../../deals/entities/deal-publication.entity';
import {DealEntity} from '../../deals/entities/deal.entity';
import {EscrowStatus} from '../../../common/constants/deals/deal-escrow-status.constants';
import {PublicationStatus} from '../../../common/constants/deals/publication-status.constants';
import {DealStatus} from '../../../common/constants/deals/deal-status.constants';
import {PayoutRequestEntity} from '../entities/payout-request.entity';
import {RefundRequestEntity} from '../entities/refund-request.entity';
import {RequestStatus} from '../../../common/constants/payments/request-status.constants';
import {SETTLEMENT_CRON} from '../../../config/payments.config';

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
    ) {}

    @Cron(SETTLEMENT_CRON)
    async handleSettlement(): Promise<void> {
        await this.queueEligiblePayouts();
        await this.queueEligibleRefunds();
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

                await escrowRepo.update(lockedEscrow.id, {
                    status: EscrowStatus.PAYOUT_PENDING,
                    payoutId: payout.id,
                });
            });

            this.logger.log(`Payout queued for escrow ${escrow.id}`);
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

}
