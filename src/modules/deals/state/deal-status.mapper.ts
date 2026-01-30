import {DealStatus} from '../types/deal-status.enum';
import {DealEscrowStatus} from '../types/deal-escrow-status.enum';

export function mapEscrowToDealStatus(
    escrow: DealEscrowStatus,
): DealStatus {
    switch (escrow) {
        case DealEscrowStatus.DRAFT:
        case DealEscrowStatus.WAITING_SCHEDULE:
        case DealEscrowStatus.WAITING_CREATIVE:
        case DealEscrowStatus.CREATIVE_SUBMITTED:
        case DealEscrowStatus.ADMIN_REVIEW:
        case DealEscrowStatus.CHANGES_REQUESTED:
        case DealEscrowStatus.AWAITING_PAYMENT:
        case DealEscrowStatus.PAYMENT_PENDING:
            return DealStatus.PENDING;
        case DealEscrowStatus.FUNDS_CONFIRMED:
        case DealEscrowStatus.SCHEDULED:
        case DealEscrowStatus.POSTING:
        case DealEscrowStatus.POSTED_VERIFYING:
            return DealStatus.ACTIVE;
        case DealEscrowStatus.RELEASED:
            return DealStatus.COMPLETED;
        case DealEscrowStatus.CANCELED:
        case DealEscrowStatus.REFUNDED:
        case DealEscrowStatus.DISPUTED:
            return DealStatus.CANCELED;
        default:
            return DealStatus.PENDING;
    }
}
