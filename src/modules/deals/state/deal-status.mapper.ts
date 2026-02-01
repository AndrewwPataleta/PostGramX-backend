import {DealStatus} from '../../../common/constants/deals/deal-status.constants';
import {DealEscrowStatus} from '../../../common/constants/deals/deal-escrow-status.constants';

export function mapEscrowToDealStatus(
    escrow: DealEscrowStatus,
): DealStatus {
    switch (escrow) {
        case DealEscrowStatus.DRAFT:
        case DealEscrowStatus.SCHEDULING_PENDING:
        case DealEscrowStatus.CREATIVE_AWAITING_SUBMIT:
        case DealEscrowStatus.CREATIVE_AWAITING_ADMIN_REVIEW:
        case DealEscrowStatus.CREATIVE_CHANGES_NOTES_PENDING:
        case DealEscrowStatus.CREATIVE_CHANGES_REQUESTED:
        case DealEscrowStatus.AWAITING_PAYMENT:
        case DealEscrowStatus.FUNDS_PENDING:
            return DealStatus.PENDING;
        case DealEscrowStatus.FUNDS_CONFIRMED:
        case DealEscrowStatus.CREATIVE_PENDING:
        case DealEscrowStatus.CREATIVE_REVIEW:
        case DealEscrowStatus.APPROVED_SCHEDULED:
        case DealEscrowStatus.POSTING:
        case DealEscrowStatus.POSTED_VERIFYING:
            return DealStatus.ACTIVE;
        case DealEscrowStatus.COMPLETED:
            return DealStatus.COMPLETED;
        case DealEscrowStatus.CANCELED:
        case DealEscrowStatus.REFUNDED:
        case DealEscrowStatus.DISPUTED:
            return DealStatus.CANCELED;
        default:
            return DealStatus.PENDING;
    }
}
