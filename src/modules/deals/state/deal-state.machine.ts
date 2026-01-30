import {DealEscrowStatus} from '../../../common/constants/deals/deal-escrow-status.constants';
import {DEAL_ESCROW_TRANSITIONS} from '../../../common/constants/deals/deal-transitions.constants';

const FINAL_STATUSES = new Set<DealEscrowStatus>([
    DealEscrowStatus.COMPLETED,
    DealEscrowStatus.CANCELED,
    DealEscrowStatus.REFUNDED,
    DealEscrowStatus.DISPUTED,
]);

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

    if (to === DealEscrowStatus.REFUNDED) {
        return !FINAL_STATUSES.has(from);
    }

    return DEAL_ESCROW_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransitionAllowed(
    from: DealEscrowStatus,
    to: DealEscrowStatus,
): void {
    if (!isTransitionAllowed(from, to)) {
        throw new DealStateError(from, to);
    }
}
