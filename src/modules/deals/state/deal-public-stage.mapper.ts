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
    [DealStage.CREATIVE_PENDING]: {
        stageKey: 'deals.stages.waiting_creative',
        shortLabel: 'Send creative',
        actionHint: 'Send the post to the bot.',
    },
    [DealStage.CREATIVE_SUBMITTED]: {
        stageKey: 'deals.stages.creative_submitted',
        shortLabel: 'Creative submitted',
        actionHint: 'Wait for review.',
    },
    [DealStage.CREATIVE_CHANGES_REQUESTED]: {
        stageKey: 'deals.stages.creative_changes_requested',
        shortLabel: 'Changes requested',
        actionHint: 'Send an updated creative.',
    },
    [DealStage.CREATIVE_APPROVED]: {
        stageKey: 'deals.stages.creative_approved',
        shortLabel: 'Creative approved',
        actionHint: 'Schedule the post.',
    },
    [DealStage.SCHEDULING_PENDING]: {
        stageKey: 'deals.stages.waiting_schedule',
        shortLabel: 'Choose time',
        actionHint: 'Select a posting date and time.',
    },
    [DealStage.SCHEDULED]: {
        stageKey: 'deals.stages.scheduled',
        shortLabel: 'Scheduled',
        actionHint: 'Complete payment.',
    },
    [DealStage.PAYMENT_PENDING]: {
        stageKey: 'deals.stages.awaiting_payment',
        shortLabel: 'Awaiting payment',
        actionHint: 'Complete payment within the window.',
    },
    [DealStage.PAID]: {
        stageKey: 'deals.stages.paid',
        shortLabel: 'Paid',
    },
    [DealStage.PUBLISHING]: {
        stageKey: 'deals.stages.posting',
        shortLabel: 'Posting',
    },
    [DealStage.PUBLISHED]: {
        stageKey: 'deals.stages.published',
        shortLabel: 'Published',
    },
    [DealStage.VERIFIED]: {
        stageKey: 'deals.stages.verified',
        shortLabel: 'Verified',
    },
    [DealStage.CANCELED]: {
        stageKey: 'deals.stages.canceled',
        shortLabel: 'Canceled',
    },
    [DealStage.FAILED]: {
        stageKey: 'deals.stages.failed',
        shortLabel: 'Failed',
    },
};

export function mapStageToPublicStage(stage: DealStage): DealPublicStage {
    return STAGE_MAP[stage] ?? DEFAULT_STAGE;
}
