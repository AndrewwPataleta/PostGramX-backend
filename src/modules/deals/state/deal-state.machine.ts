import {DealEscrowStatus} from '../types/deal-escrow-status.enum';

const FINAL_STATUSES = new Set<DealEscrowStatus>([
    DealEscrowStatus.RELEASED,
    DealEscrowStatus.CANCELED,
    DealEscrowStatus.REFUNDED,
    DealEscrowStatus.DISPUTED,
]);

const ESCROW_TRANSITIONS: Record<DealEscrowStatus, DealEscrowStatus[]> = {
    [DealEscrowStatus.DRAFT]: [
        DealEscrowStatus.WAITING_SCHEDULE,
        DealEscrowStatus.CANCELED,
    ],
    [DealEscrowStatus.WAITING_SCHEDULE]: [
        DealEscrowStatus.WAITING_CREATIVE,
    ],
    [DealEscrowStatus.WAITING_CREATIVE]: [
        DealEscrowStatus.CREATIVE_SUBMITTED,
        DealEscrowStatus.ADMIN_REVIEW,
    ],
    [DealEscrowStatus.CREATIVE_SUBMITTED]: [
        DealEscrowStatus.ADMIN_REVIEW,
    ],
    [DealEscrowStatus.ADMIN_REVIEW]: [
        DealEscrowStatus.AWAITING_PAYMENT,
        DealEscrowStatus.CHANGES_REQUESTED,
    ],
    [DealEscrowStatus.CHANGES_REQUESTED]: [
        DealEscrowStatus.CREATIVE_SUBMITTED,
        DealEscrowStatus.ADMIN_REVIEW,
    ],
    [DealEscrowStatus.AWAITING_PAYMENT]: [
        DealEscrowStatus.PAYMENT_PENDING,
        DealEscrowStatus.FUNDS_CONFIRMED,
        DealEscrowStatus.REFUNDED,
    ],
    [DealEscrowStatus.PAYMENT_PENDING]: [
        DealEscrowStatus.FUNDS_CONFIRMED,
        DealEscrowStatus.REFUNDED,
    ],
    [DealEscrowStatus.FUNDS_CONFIRMED]: [
        DealEscrowStatus.SCHEDULED,
        DealEscrowStatus.POSTING,
        DealEscrowStatus.DISPUTED,
    ],
    [DealEscrowStatus.SCHEDULED]: [DealEscrowStatus.POSTING],
    [DealEscrowStatus.POSTING]: [DealEscrowStatus.POSTED_VERIFYING],
    [DealEscrowStatus.POSTED_VERIFYING]: [
        DealEscrowStatus.RELEASED,
        DealEscrowStatus.DISPUTED,
    ],
    [DealEscrowStatus.RELEASED]: [],
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
