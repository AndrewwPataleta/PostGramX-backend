import {DealEscrowStatus} from '../../common/constants/deals/deal-escrow-status.constants';
import {assertTransitionAllowed, isTransitionAllowed} from './state/deal-state.machine';

export function canTransitionDealEscrowStatus(
    from: DealEscrowStatus,
    to: DealEscrowStatus,
): boolean {
    return isTransitionAllowed(from, to);
}

export function assertDealEscrowTransition(
    from: DealEscrowStatus,
    to: DealEscrowStatus,
): void {
    assertTransitionAllowed(from, to);
}
