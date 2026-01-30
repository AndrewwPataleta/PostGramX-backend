import {DealEscrowStatus} from '../types/deal-escrow-status.enum';
import {isTransitionAllowed} from './deal-state.machine';

describe('deal state machine', () => {
    it('allows the happy path transitions', () => {
        const path: DealEscrowStatus[] = [
            DealEscrowStatus.SCHEDULING_PENDING,
            DealEscrowStatus.CREATIVE_AWAITING_SUBMIT,
            DealEscrowStatus.CREATIVE_AWAITING_CONFIRM,
            DealEscrowStatus.ADMIN_REVIEW,
            DealEscrowStatus.PAYMENT_WINDOW_PENDING,
            DealEscrowStatus.PAYMENT_AWAITING,
            DealEscrowStatus.FUNDS_PENDING,
            DealEscrowStatus.FUNDS_CONFIRMED,
            DealEscrowStatus.CREATIVE_PENDING,
            DealEscrowStatus.CREATIVE_REVIEW,
            DealEscrowStatus.APPROVED_SCHEDULED,
            DealEscrowStatus.POSTED_VERIFYING,
            DealEscrowStatus.COMPLETED,
        ];

        for (let i = 0; i < path.length - 1; i += 1) {
            expect(isTransitionAllowed(path[i], path[i + 1])).toBe(true);
        }
    });

    it('allows canceling deals during pending stages', () => {
        const cancellableStages: DealEscrowStatus[] = [
            DealEscrowStatus.DRAFT,
            DealEscrowStatus.SCHEDULING_PENDING,
            DealEscrowStatus.CREATIVE_AWAITING_SUBMIT,
            DealEscrowStatus.CREATIVE_AWAITING_CONFIRM,
            DealEscrowStatus.ADMIN_REVIEW,
            DealEscrowStatus.PAYMENT_WINDOW_PENDING,
            DealEscrowStatus.PAYMENT_AWAITING,
            DealEscrowStatus.FUNDS_PENDING,
        ];

        for (const status of cancellableStages) {
            expect(
                isTransitionAllowed(status, DealEscrowStatus.CANCELED),
            ).toBe(true);
        }
    });
});
