import {DealEscrowStatus} from '../types/deal-escrow-status.enum';

export function mapLegacyNegotiatingStatus(
    scheduledAt: Date | null,
    brief: string | null,
): DealEscrowStatus {
    if (!scheduledAt) {
        return DealEscrowStatus.WAITING_SCHEDULE;
    }

    if (!brief || brief.trim().length === 0) {
        return DealEscrowStatus.WAITING_CREATIVE;
    }

    return DealEscrowStatus.ADMIN_REVIEW;
}
