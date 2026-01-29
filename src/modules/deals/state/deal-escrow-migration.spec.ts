import {mapLegacyNegotiatingStatus} from './deal-escrow-migration';
import {DealEscrowStatus} from '../types/deal-escrow-status.enum';

describe('mapLegacyNegotiatingStatus', () => {
    it('maps to scheduling pending when no scheduledAt', () => {
        expect(mapLegacyNegotiatingStatus(null, null)).toBe(
            DealEscrowStatus.SCHEDULING_PENDING,
        );
    });

    it('maps to creative awaiting submit when scheduled but no brief', () => {
        expect(mapLegacyNegotiatingStatus(new Date(), null)).toBe(
            DealEscrowStatus.CREATIVE_AWAITING_SUBMIT,
        );
        expect(mapLegacyNegotiatingStatus(new Date(), '  ')).toBe(
            DealEscrowStatus.CREATIVE_AWAITING_SUBMIT,
        );
    });

    it('maps to admin review when scheduled and brief present', () => {
        expect(mapLegacyNegotiatingStatus(new Date(), 'Ready')).toBe(
            DealEscrowStatus.ADMIN_REVIEW,
        );
    });
});
