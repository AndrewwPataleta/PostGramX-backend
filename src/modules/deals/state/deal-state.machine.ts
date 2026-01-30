import {DealEscrowStatus} from '../types/deal-escrow-status.enum';

const FINAL_STATUSES = new Set<DealEscrowStatus>([
    DealEscrowStatus.COMPLETED,
    DealEscrowStatus.CANCELED,
    DealEscrowStatus.REFUNDED,
    DealEscrowStatus.DISPUTED,
]);

const ESCROW_TRANSITIONS: Record<DealEscrowStatus, DealEscrowStatus[]> = {
    [DealEscrowStatus.DRAFT]: [
        DealEscrowStatus.SCHEDULING_PENDING,
        DealEscrowStatus.CANCELED,
    ],
    [DealEscrowStatus.SCHEDULING_PENDING]: [
        DealEscrowStatus.CREATIVE_AWAITING_SUBMIT,
    ],
    [DealEscrowStatus.CREATIVE_AWAITING_SUBMIT]: [
        DealEscrowStatus.CREATIVE_AWAITING_CONFIRM,
    ],
    [DealEscrowStatus.CREATIVE_AWAITING_CONFIRM]: [
        DealEscrowStatus.ADMIN_REVIEW,
    ],
    [DealEscrowStatus.ADMIN_REVIEW]: [
        DealEscrowStatus.PAYMENT_WINDOW_PENDING,
    ],
    [DealEscrowStatus.PAYMENT_WINDOW_PENDING]: [
        DealEscrowStatus.PAYMENT_AWAITING,
    ],
    [DealEscrowStatus.PAYMENT_AWAITING]: [
        DealEscrowStatus.FUNDS_PENDING,
        DealEscrowStatus.REFUNDED,
    ],
    [DealEscrowStatus.FUNDS_PENDING]: [
        DealEscrowStatus.FUNDS_CONFIRMED,
        DealEscrowStatus.REFUNDED,
    ],
    [DealEscrowStatus.FUNDS_CONFIRMED]: [
        DealEscrowStatus.CREATIVE_PENDING,
        DealEscrowStatus.APPROVED_SCHEDULED,
        DealEscrowStatus.DISPUTED,
    ],
    [DealEscrowStatus.CREATIVE_PENDING]: [
        DealEscrowStatus.CREATIVE_REVIEW,
        DealEscrowStatus.DISPUTED,
    ],
    [DealEscrowStatus.CREATIVE_REVIEW]: [
        DealEscrowStatus.APPROVED_SCHEDULED,
        DealEscrowStatus.DISPUTED,
    ],
    [DealEscrowStatus.APPROVED_SCHEDULED]: [
        DealEscrowStatus.POSTED_VERIFYING,
        DealEscrowStatus.DISPUTED,
    ],
    [DealEscrowStatus.POSTED_VERIFYING]: [
        DealEscrowStatus.COMPLETED,
        DealEscrowStatus.DISPUTED,
    ],
    [DealEscrowStatus.COMPLETED]: [],
    [DealEscrowStatus.CANCELED]: [],
    [DealEscrowStatus.REFUNDED]: [],
    [DealEscrowStatus.DISPUTED]: [],
};

export class DealStateError extends Error {
    constructor(
        public readonly from: DealEscrowStatus,
        public readonly to: DealEscrowStatus,
    ) {
        super(`Invalid escrow transition from ${from} to ${to}`);
        this.name = 'DealStateError';
    }
}

export function isTransitionAllowed(
    from: DealEscrowStatus,
    to: DealEscrowStatus,
): boolean {
    if (from === to) {
        return true;
    }

    if (to === DealEscrowStatus.CANCELED) {
        return !FINAL_STATUSES.has(from);
    }

    return ESCROW_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransitionAllowed(
    from: DealEscrowStatus,
    to: DealEscrowStatus,
): void {
    if (!isTransitionAllowed(from, to)) {
        throw new DealStateError(from, to);
    }
}
