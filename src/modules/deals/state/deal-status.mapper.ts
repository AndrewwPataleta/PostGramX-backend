import {DealStatus} from '../../../common/constants/deals/deal-status.constants';
import {DealStage} from '../../../common/constants/deals/deal-stage.constants';
import {EscrowStatus} from '../../../common/constants/deals/deal-escrow-status.constants';

export function mapStageToDealStatus(stage: DealStage): DealStatus {
    switch (stage) {
        case DealStage.SCHEDULING_PENDING:
        case DealStage.CREATIVE_AWAITING_SUBMIT:
        case DealStage.CREATIVE_SUBMITTED:
        case DealStage.ADMIN_REVIEW_PENDING:
        case DealStage.PAYMENT_AWAITING:
        case DealStage.PAYMENT_PARTIALLY_PAID:
            return DealStatus.PENDING;
        case DealStage.POST_SCHEDULED:
        case DealStage.POST_PUBLISHING:
        case DealStage.POSTED_VERIFYING:
        case DealStage.DELIVERY_CONFIRMED:
            return DealStatus.ACTIVE;
        case DealStage.REFUNDING:
            return DealStatus.CANCELED;
        case DealStage.FINALIZED:
            return DealStatus.COMPLETED;
        default:
            return DealStatus.PENDING;
    }
}

export function mapEscrowToStage(status: EscrowStatus): DealStage {
    switch (status) {
        case EscrowStatus.AWAITING_PAYMENT:
            return DealStage.PAYMENT_AWAITING;
        case EscrowStatus.PARTIALLY_PAID:
            return DealStage.PAYMENT_PARTIALLY_PAID;
        case EscrowStatus.PAID_CONFIRMED:
            return DealStage.POST_SCHEDULED;
        case EscrowStatus.REFUNDED:
        case EscrowStatus.FAILED:
        case EscrowStatus.EXPIRED:
            return DealStage.REFUNDING;
        case EscrowStatus.RELEASED:
            return DealStage.DELIVERY_CONFIRMED;
        case EscrowStatus.NOT_CREATED:
        default:
            return DealStage.SCHEDULING_PENDING;
    }
}
