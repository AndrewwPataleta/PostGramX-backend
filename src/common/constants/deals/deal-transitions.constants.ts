import {DealStage} from './deal-stage.constants';

export const DEAL_STAGE_TRANSITIONS: Record<DealStage, DealStage[]> = {
    [DealStage.CREATIVE_SUBMITTED]: [
        DealStage.CREATIVE_APPROVED,
        DealStage.CREATIVE_CHANGES_REQUESTED,
    ],
    [DealStage.CREATIVE_PENDING]: [DealStage.CREATIVE_SUBMITTED],
    [DealStage.CREATIVE_CHANGES_REQUESTED]: [DealStage.CREATIVE_SUBMITTED],
    [DealStage.CREATIVE_APPROVED]: [DealStage.SCHEDULED],
    [DealStage.SCHEDULING_PENDING]: [DealStage.SCHEDULED],
    [DealStage.SCHEDULED]: [DealStage.PAYMENT_PENDING, DealStage.PAID],
    [DealStage.PAYMENT_PENDING]: [DealStage.PAID],
    [DealStage.PAID]: [DealStage.PUBLISHING],
    [DealStage.PUBLISHING]: [DealStage.PUBLISHED],
    [DealStage.PUBLISHED]: [DealStage.VERIFIED],
    [DealStage.VERIFIED]: [],
    [DealStage.CANCELED]: [],
    [DealStage.FAILED]: [],
};
