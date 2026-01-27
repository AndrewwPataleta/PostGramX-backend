import {DealEscrowStatus} from './types/deal-escrow-status.enum';

const ESCROW_TRANSITIONS: Record<DealEscrowStatus, DealEscrowStatus[]> = {
    [DealEscrowStatus.DRAFT]: [DealEscrowStatus.NEGOTIATING],
    [DealEscrowStatus.NEGOTIATING]: [
        DealEscrowStatus.AWAITING_PAYMENT,
        DealEscrowStatus.CANCELED,
    ],
    [DealEscrowStatus.AWAITING_PAYMENT]: [
        DealEscrowStatus.FUNDS_PENDING,
        DealEscrowStatus.CANCELED,
    ],
    [DealEscrowStatus.FUNDS_PENDING]: [
        DealEscrowStatus.FUNDS_CONFIRMED,
        DealEscrowStatus.CANCELED,
        DealEscrowStatus.REFUNDED,
    ],
    [DealEscrowStatus.FUNDS_CONFIRMED]: [
        DealEscrowStatus.CREATIVE_PENDING,
        DealEscrowStatus.REFUNDED,
        DealEscrowStatus.DISPUTED,
    ],
    [DealEscrowStatus.CREATIVE_PENDING]: [
        DealEscrowStatus.CREATIVE_REVIEW,
        DealEscrowStatus.REFUNDED,
        DealEscrowStatus.DISPUTED,
    ],
    [DealEscrowStatus.CREATIVE_REVIEW]: [
        DealEscrowStatus.APPROVED_SCHEDULED,
        DealEscrowStatus.REFUNDED,
        DealEscrowStatus.DISPUTED,
    ],
    [DealEscrowStatus.APPROVED_SCHEDULED]: [
        DealEscrowStatus.POSTED_VERIFYING,
        DealEscrowStatus.REFUNDED,
        DealEscrowStatus.DISPUTED,
    ],
    [DealEscrowStatus.POSTED_VERIFYING]: [
        DealEscrowStatus.COMPLETED,
        DealEscrowStatus.REFUNDED,
        DealEscrowStatus.DISPUTED,
    ],
    [DealEscrowStatus.COMPLETED]: [],
    [DealEscrowStatus.CANCELED]: [],
    [DealEscrowStatus.REFUNDED]: [],
    [DealEscrowStatus.DISPUTED]: [],
};

export function canTransitionDealEscrowStatus(
    from: DealEscrowStatus,
    to: DealEscrowStatus,
): boolean {
    return ESCROW_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertDealEscrowTransition(
    from: DealEscrowStatus,
    to: DealEscrowStatus,
): void {
    if (!canTransitionDealEscrowStatus(from, to)) {
        throw new Error(`Invalid escrow transition from ${from} to ${to}`);
    }
}
