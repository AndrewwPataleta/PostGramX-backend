import {DealEscrowStatus} from '../types/deal-escrow-status.enum';
import {isTransitionAllowed} from './deal-state.machine';

describe('deal state machine', () => {
    it('allows the happy path transitions', () => {
        const path: DealEscrowStatus[] = [
            DealEscrowStatus.WAITING_SCHEDULE,
            DealEscrowStatus.WAITING_CREATIVE,
            DealEscrowStatus.CREATIVE_SUBMITTED,
            DealEscrowStatus.ADMIN_REVIEW,
            DealEscrowStatus.AWAITING_PAYMENT,
            DealEscrowStatus.FUNDS_CONFIRMED,
            DealEscrowStatus.SCHEDULED,
            DealEscrowStatus.POSTING,
            DealEscrowStatus.POSTED_VERIFYING,
            DealEscrowStatus.RELEASED,
        ];

        for (let i = 0; i < path.length - 1; i += 1) {
            expect(isTransitionAllowed(path[i], path[i + 1])).toBe(true);
        }
    });

    it('allows canceling deals during pending stages', () => {
        const cancellableStages: DealEscrowStatus[] = [
            DealEscrowStatus.DRAFT,
            DealEscrowStatus.WAITING_SCHEDULE,
            DealEscrowStatus.WAITING_CREATIVE,
            DealEscrowStatus.CREATIVE_SUBMITTED,
            DealEscrowStatus.ADMIN_REVIEW,
            DealEscrowStatus.CHANGES_REQUESTED,
            DealEscrowStatus.AWAITING_PAYMENT,
            DealEscrowStatus.PAYMENT_PENDING,
        ];

        for (const status of cancellableStages) {
            expect(
                isTransitionAllowed(status, DealEscrowStatus.CANCELED),
            ).toBe(true);
        }
    });
});
