import {DealEscrowStatus} from '../types/deal-escrow-status.enum';

export function mapLegacyNegotiatingStatus(
    scheduledAt: Date | null,
    brief: string | null,
): DealEscrowStatus {
    if (!scheduledAt) {
        return DealEscrowStatus.SCHEDULING_PENDING;
    }

    if (!brief || brief.trim().length === 0) {
        return DealEscrowStatus.CREATIVE_AWAITING_SUBMIT;
    }

    return DealEscrowStatus.ADMIN_REVIEW;
}
