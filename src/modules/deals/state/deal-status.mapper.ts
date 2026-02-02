import {DealStatus} from '../../../common/constants/deals/deal-status.constants';
import {DealStage} from '../../../common/constants/deals/deal-stage.constants';
import {EscrowStatus} from '../../../common/constants/deals/deal-escrow-status.constants';

export function mapStageToDealStatus(stage: DealStage): DealStatus {
    switch (stage) {
        case DealStage.CREATIVE_PENDING:
        case DealStage.CREATIVE_SUBMITTED:
        case DealStage.CREATIVE_CHANGES_REQUESTED:
        case DealStage.CREATIVE_APPROVED:
        case DealStage.SCHEDULING_PENDING:
        case DealStage.SCHEDULED:
        case DealStage.PAYMENT_PENDING:
            return DealStatus.PENDING;
        case DealStage.PAID:
        case DealStage.PUBLISHING:
        case DealStage.PUBLISHED:
            return DealStatus.ACTIVE;
        case DealStage.CANCELED:
        case DealStage.FAILED:
            return DealStatus.CANCELED;
        case DealStage.VERIFIED:
            return DealStatus.COMPLETED;
        default:
            return DealStatus.PENDING;
    }
}

export function mapEscrowToStage(status: EscrowStatus): DealStage {
    switch (status) {
        case EscrowStatus.AWAITING_PAYMENT:
            return DealStage.PAYMENT_PENDING;
        case EscrowStatus.PARTIALLY_PAID:
            return DealStage.PAYMENT_PENDING;
        case EscrowStatus.PAID_CONFIRMED:
            return DealStage.PAID;
        case EscrowStatus.REFUNDED:
        case EscrowStatus.FAILED:
        case EscrowStatus.EXPIRED:
            return DealStage.CANCELED;
        case EscrowStatus.RELEASED:
            return DealStage.VERIFIED;
        case EscrowStatus.CREATED:
        default:
            return DealStage.CREATIVE_PENDING;
    }
}
