import {DealStage} from '../../../common/constants/deals/deal-stage.constants';

export type DealPublicStage = {
    stageKey: string;
    shortLabel: string;
    actionHint?: string;
};

const DEFAULT_STAGE: DealPublicStage = {
    stageKey: 'deals.stages.unknown',
    shortLabel: 'Unknown status',
};

const STAGE_MAP: Record<DealStage, DealPublicStage> = {

    [DealStage.CREATIVE_AWAITING_SUBMIT]: {
        stageKey: 'deals.stages.waiting_creative',
        shortLabel: 'Send creative',
        actionHint: 'Send the post to the bot.',
    },
    [DealStage.CREATIVE_AWAITING_CONFIRM]: {
        stageKey: 'deals.stages.waiting_creative_approve',
        shortLabel: 'Create waiting approve',
        actionHint: 'Create waiting approve',
    },
    [DealStage.SCHEDULING_AWAITING_SUBMIT]: {
        stageKey: 'deals.stages.waiting_schedule',
        shortLabel: 'Awaiting admin review',
    },
    [DealStage.SCHEDULING_AWAITING_CONFIRM]: {
        stageKey: 'deals.stages.waiting_schedule',
        shortLabel: 'Awaiting admin review',
    },
    [DealStage.PAYMENT_AWAITING]: {
        stageKey: 'deals.stages.awaiting_payment',
        shortLabel: 'Awaiting payment',
        actionHint: 'Complete payment within the window.',
    },
    [DealStage.PAYMENT_PARTIALLY_PAID]: {
        stageKey: 'deals.stages.payment_partial',
        shortLabel: 'Partial payment',
        actionHint: 'Complete the remaining payment.',
    },
    [DealStage.POST_SCHEDULED]: {
        stageKey: 'deals.stages.scheduled',
        shortLabel: 'Scheduled',
    },
    [DealStage.POST_PUBLISHING]: {
        stageKey: 'deals.stages.posting',
        shortLabel: 'Posting',
    },
    [DealStage.POSTED_VERIFYING]: {
        stageKey: 'deals.stages.posted_verifying',
        shortLabel: 'Verifying post',
    },
    [DealStage.DELIVERY_CONFIRMED]: {
        stageKey: 'deals.stages.released',
        shortLabel: 'Delivered',
    },
    [DealStage.REFUNDING]: {
        stageKey: 'deals.stages.refunding',
        shortLabel: 'Refunding',
    },
    [DealStage.FINALIZED]: {
        stageKey: 'deals.stages.finalized',
        shortLabel: 'Finalized',
    },
};

export function mapStageToPublicStage(stage: DealStage): DealPublicStage {
    return STAGE_MAP[stage] ?? DEFAULT_STAGE;
}
