import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {DealEntity} from '../../deals/entities/deal.entity';
import {DealEscrowEntity} from '../../deals/entities/deal-escrow.entity';
import {
    EscrowServiceError,
    EscrowServiceErrorCode,
} from './errors/escrow-service.error';
import {EscrowStatus} from '../../../common/constants/deals/deal-escrow-status.constants';
import {ChannelMembershipEntity} from '../../channels/entities/channel-membership.entity';
import {DealStage} from '../../../common/constants/deals/deal-stage.constants';

@Injectable()
export class EscrowService {
    constructor(
        @InjectRepository(DealEntity)
        private readonly dealRepository: Repository<DealEntity>,
        @InjectRepository(DealEscrowEntity)
        private readonly escrowRepository: Repository<DealEscrowEntity>,
        @InjectRepository(ChannelMembershipEntity)
        private readonly membershipRepository: Repository<ChannelMembershipEntity>,
    ) {}

    async initDealEscrow(userId: string, dealId: string) {
        const deal = await this.dealRepository.findOne({where: {id: dealId}});

        if (!deal) {
            throw new EscrowServiceError(EscrowServiceErrorCode.DEAL_NOT_FOUND);
        }

        if (deal.advertiserUserId !== userId) {
            throw new EscrowServiceError(EscrowServiceErrorCode.FORBIDDEN);
        }

        if (
            ![
                DealStage.SCHEDULED,
                DealStage.PAYMENT_PENDING,
                DealStage.PAID,
            ].includes(deal.stage)
        ) {
            throw new EscrowServiceError(EscrowServiceErrorCode.INVALID_TRANSITION);
        }

        const escrow = await this.escrowRepository.findOne({
            where: {dealId: deal.id},
        });

        if (!escrow) {
            throw new EscrowServiceError(EscrowServiceErrorCode.ESCROW_WALLET_MISSING);
        }

        if (escrow.status !== EscrowStatus.AWAITING_PAYMENT) {
            throw new EscrowServiceError(EscrowServiceErrorCode.INVALID_TRANSITION);
        }

        return {
            dealId: deal.id,
            escrowStatus: escrow.status,
            depositAddress: escrow.paymentAddress,
            expiresAt: escrow.paymentDeadlineAt,
        };
    }

    async getDealEscrowStatus(userId: string, dealId: string) {
        const deal = await this.dealRepository.findOne({where: {id: dealId}});

        if (!deal) {
            throw new EscrowServiceError(EscrowServiceErrorCode.DEAL_NOT_FOUND);
        }

        const isPublisher =
            (await this.membershipRepository.findOne({
                where: {channelId: deal.channelId, userId},
            })) !== null;

        if (deal.advertiserUserId !== userId && !isPublisher) {
            throw new EscrowServiceError(EscrowServiceErrorCode.FORBIDDEN);
        }

        const escrow = await this.escrowRepository.findOne({
            where: {dealId: deal.id},
        });

        return {
            dealId: deal.id,
            escrowStatus: escrow?.status ?? EscrowStatus.CREATED,
            depositAddress: escrow?.paymentAddress ?? null,
            amountNano: escrow?.amountNano ?? null,
            expiresAt: escrow?.paymentDeadlineAt ?? null,
            lastActivityAt: deal.lastActivityAt,
        };
    }
}
