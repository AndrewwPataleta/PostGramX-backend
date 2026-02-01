import {DealStage} from './deal-stage.constants';

export const DEAL_STAGE_TRANSITIONS: Record<DealStage, DealStage[]> = {
    [DealStage.SCHEDULING_PENDING]: [
        DealStage.CREATIVE_AWAITING_SUBMIT,
        DealStage.FINALIZED,
    ],
    [DealStage.CREATIVE_AWAITING_SUBMIT]: [
        DealStage.CREATIVE_SUBMITTED,
        DealStage.FINALIZED,
    ],
    [DealStage.CREATIVE_SUBMITTED]: [
        DealStage.ADMIN_REVIEW_PENDING,
        DealStage.CREATIVE_AWAITING_SUBMIT,
        DealStage.FINALIZED,
    ],
    [DealStage.ADMIN_REVIEW_PENDING]: [
        DealStage.PAYMENT_AWAITING,
        DealStage.CREATIVE_AWAITING_SUBMIT,
        DealStage.FINALIZED,
    ],
    [DealStage.PAYMENT_AWAITING]: [
        DealStage.PAYMENT_PARTIALLY_PAID,
        DealStage.POST_SCHEDULED,
        DealStage.REFUNDING,
        DealStage.FINALIZED,
    ],
    [DealStage.PAYMENT_PARTIALLY_PAID]: [
        DealStage.POST_SCHEDULED,
        DealStage.REFUNDING,
        DealStage.FINALIZED,
    ],
    [DealStage.POST_SCHEDULED]: [
        DealStage.POST_PUBLISHING,
        DealStage.REFUNDING,
        DealStage.FINALIZED,
    ],
    [DealStage.POST_PUBLISHING]: [
        DealStage.POSTED_VERIFYING,
        DealStage.REFUNDING,
        DealStage.FINALIZED,
    ],
    [DealStage.POSTED_VERIFYING]: [
        DealStage.DELIVERY_CONFIRMED,
        DealStage.REFUNDING,
        DealStage.FINALIZED,
    ],
    [DealStage.DELIVERY_CONFIRMED]: [DealStage.FINALIZED],
    [DealStage.REFUNDING]: [DealStage.FINALIZED],
    [DealStage.FINALIZED]: [],
};
