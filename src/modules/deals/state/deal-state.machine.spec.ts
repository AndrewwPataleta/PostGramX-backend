import {DealStage} from '../../../common/constants/deals/deal-stage.constants';
import {assertTransitionAllowed, isTransitionAllowed} from './deal-state.machine';

describe('deal state machine', () => {
    it('allows creative resubmission after changes requested', () => {
        expect(
            isTransitionAllowed(
                DealStage.CREATIVE_CHANGES_REQUESTED,
                DealStage.CREATIVE_SUBMITTED,
            ),
        ).toBe(true);
    });

    it('blocks scheduling before creative approval', () => {
        expect(
            isTransitionAllowed(
                DealStage.CREATIVE_PENDING,
                DealStage.SCHEDULED,
            ),
        ).toBe(false);
    });

    it('supports the MVP happy path', () => {
        const stages = [
            DealStage.CREATIVE_PENDING,
            DealStage.CREATIVE_SUBMITTED,
            DealStage.CREATIVE_APPROVED,
            DealStage.SCHEDULED,
            DealStage.PAID,
            DealStage.PUBLISHING,
            DealStage.PUBLISHED,
            DealStage.VERIFIED,
        ];

        for (let i = 0; i < stages.length - 1; i += 1) {
            expect(() =>
                assertTransitionAllowed(stages[i], stages[i + 1]),
            ).not.toThrow();
        }
    });
});
