import {DealStatus} from '../types/deal-status.enum';
import {DealEscrowStatus} from '../types/deal-escrow-status.enum';

export function mapEscrowToDealStatus(
    escrow: DealEscrowStatus,
): DealStatus {
    switch (escrow) {
        case DealEscrowStatus.DRAFT:
        case DealEscrowStatus.SCHEDULING_PENDING:
        case DealEscrowStatus.CREATIVE_AWAITING_SUBMIT:
        case DealEscrowStatus.CREATIVE_AWAITING_ADMIN_REVIEW:
        case DealEscrowStatus.PAYMENT_AWAITING:
        case DealEscrowStatus.FUNDS_PENDING:
            return DealStatus.PENDING;
        case DealEscrowStatus.FUNDS_CONFIRMED:
        case DealEscrowStatus.CREATIVE_PENDING:
        case DealEscrowStatus.CREATIVE_REVIEW:
        case DealEscrowStatus.APPROVED_SCHEDULED:
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
