import {assertTransitionAllowed, isTransitionAllowed} from './deal-state.machine';
import {DealEscrowStatus} from '../types/deal-escrow-status.enum';

describe('deal-state.machine', () => {
    it('allows agreement flow transitions', () => {
        const transitions: Array<[DealEscrowStatus, DealEscrowStatus]> = [
            [
                DealEscrowStatus.SCHEDULING_PENDING,
                DealEscrowStatus.CREATIVE_AWAITING_SUBMIT,
            ],
            [
                DealEscrowStatus.CREATIVE_AWAITING_SUBMIT,
                DealEscrowStatus.CREATIVE_AWAITING_CONFIRM,
            ],
            [
                DealEscrowStatus.CREATIVE_AWAITING_CONFIRM,
                DealEscrowStatus.ADMIN_REVIEW,
            ],
            [
                DealEscrowStatus.ADMIN_REVIEW,
                DealEscrowStatus.PAYMENT_WINDOW_PENDING,
            ],
            [
                DealEscrowStatus.PAYMENT_WINDOW_PENDING,
                DealEscrowStatus.PAYMENT_AWAITING,
            ],
            [DealEscrowStatus.PAYMENT_AWAITING, DealEscrowStatus.FUNDS_PENDING],
            [DealEscrowStatus.FUNDS_PENDING, DealEscrowStatus.FUNDS_CONFIRMED],
        ];

        for (const [from, to] of transitions) {
            expect(isTransitionAllowed(from, to)).toBe(true);
            expect(() => assertTransitionAllowed(from, to)).not.toThrow();
        }
    });

    it('allows execution flow transitions', () => {
        const transitions: Array<[DealEscrowStatus, DealEscrowStatus]> = [
            [DealEscrowStatus.FUNDS_CONFIRMED, DealEscrowStatus.APPROVED_SCHEDULED],
            [
                DealEscrowStatus.APPROVED_SCHEDULED,
                DealEscrowStatus.POSTED_VERIFYING,
            ],
            [DealEscrowStatus.POSTED_VERIFYING, DealEscrowStatus.COMPLETED],
        ];

        for (const [from, to] of transitions) {
            expect(isTransitionAllowed(from, to)).toBe(true);
        }
    });

    it('allows cancel from non-final states', () => {
        expect(
            isTransitionAllowed(
                DealEscrowStatus.ADMIN_REVIEW,
                DealEscrowStatus.CANCELED,
            ),
        ).toBe(true);
        expect(
            isTransitionAllowed(
                DealEscrowStatus.CANCELED,
                DealEscrowStatus.CANCELED,
            ),
        ).toBe(true);
        expect(
            isTransitionAllowed(
                DealEscrowStatus.COMPLETED,
                DealEscrowStatus.CANCELED,
            ),
        ).toBe(false);
    });

    it('allows no-op transitions', () => {
        expect(
            isTransitionAllowed(
                DealEscrowStatus.PAYMENT_AWAITING,
                DealEscrowStatus.PAYMENT_AWAITING,
            ),
        ).toBe(true);
    });
});
