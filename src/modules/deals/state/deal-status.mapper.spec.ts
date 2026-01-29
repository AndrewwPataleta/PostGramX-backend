import {mapEscrowToDealStatus} from './deal-status.mapper';
import {DealEscrowStatus} from '../types/deal-escrow-status.enum';
import {DealStatus} from '../types/deal-status.enum';

describe('mapEscrowToDealStatus', () => {
    it('maps agreement statuses to pending', () => {
        const pendingStatuses = [
            DealEscrowStatus.DRAFT,
            DealEscrowStatus.SCHEDULING_PENDING,
            DealEscrowStatus.CREATIVE_AWAITING_SUBMIT,
            DealEscrowStatus.CREATIVE_AWAITING_CONFIRM,
            DealEscrowStatus.ADMIN_REVIEW,
            DealEscrowStatus.PAYMENT_WINDOW_PENDING,
            DealEscrowStatus.PAYMENT_AWAITING,
            DealEscrowStatus.FUNDS_PENDING,
        ];

        for (const status of pendingStatuses) {
            expect(mapEscrowToDealStatus(status)).toBe(DealStatus.PENDING);
        }
    });

    it('maps active statuses correctly', () => {
        const activeStatuses = [
            DealEscrowStatus.FUNDS_CONFIRMED,
            DealEscrowStatus.CREATIVE_PENDING,
            DealEscrowStatus.CREATIVE_REVIEW,
            DealEscrowStatus.APPROVED_SCHEDULED,
            DealEscrowStatus.POSTED_VERIFYING,
        ];

        for (const status of activeStatuses) {
            expect(mapEscrowToDealStatus(status)).toBe(DealStatus.ACTIVE);
        }
    });

    it('maps final statuses correctly', () => {
        expect(mapEscrowToDealStatus(DealEscrowStatus.COMPLETED)).toBe(
            DealStatus.COMPLETED,
        );

        for (const status of [
            DealEscrowStatus.CANCELED,
            DealEscrowStatus.REFUNDED,
            DealEscrowStatus.DISPUTED,
        ]) {
            expect(mapEscrowToDealStatus(status)).toBe(DealStatus.CANCELED);
        }
    });
});
