import {DealEscrowStatus} from '../../../common/constants/deals/deal-escrow-status.constants';

export type DealPublicStage = {
    stageKey: string;
    shortLabel: string;
    actionHint?: string;
};

const DEFAULT_STAGE: DealPublicStage = {
    stageKey: 'deals.stages.unknown',
    shortLabel: 'Unknown status',
};

const STAGE_MAP: Record<DealEscrowStatus, DealPublicStage> = {
    [DealEscrowStatus.DRAFT]: {
        stageKey: 'deals.stages.draft',
        shortLabel: 'Draft',
    },
    [DealEscrowStatus.SCHEDULING_PENDING]: {
        stageKey: 'deals.stages.waiting_schedule',
        shortLabel: 'Choose time',
        actionHint: 'Select a posting date and time.',
    },
    [DealEscrowStatus.CREATIVE_AWAITING_SUBMIT]: {
        stageKey: 'deals.stages.waiting_creative',
        shortLabel: 'Send creative',
        actionHint: 'Send the post to the bot.',
    },
    [DealEscrowStatus.CREATIVE_AWAITING_ADMIN_REVIEW]: {
        stageKey: 'deals.stages.admin_review',
        shortLabel: 'Awaiting admin review',
    },
    [DealEscrowStatus.AWAITING_PAYMENT]: {
        stageKey: 'deals.stages.awaiting_payment',
        shortLabel: 'Awaiting payment',
        actionHint: 'Complete payment within the window.',
    },
    [DealEscrowStatus.FUNDS_PENDING]: {
        stageKey: 'deals.stages.PAYMENT_AWAITING',
        shortLabel: 'Payment processing',
    },
    [DealEscrowStatus.FUNDS_CONFIRMED]: {
        stageKey: 'deals.stages.funds_confirmed',
        shortLabel: 'Payment confirmed',
    },
    [DealEscrowStatus.CREATIVE_PENDING]: {
        stageKey: 'deals.stages.waiting_creative',
        shortLabel: 'Creative pending',
        actionHint: 'Send the final creative for review.',
    },
    [DealEscrowStatus.CREATIVE_REVIEW]: {
        stageKey: 'deals.stages.creative_submitted',
        shortLabel: 'Creative review',
        actionHint: 'Awaiting final approval.',
    },
    [DealEscrowStatus.APPROVED_SCHEDULED]: {
        stageKey: 'deals.stages.scheduled',
        shortLabel: 'Scheduled',
    },
    [DealEscrowStatus.POSTING]: {
        stageKey: 'deals.stages.posting',
        shortLabel: 'Posting',
    },
    [DealEscrowStatus.POSTED_VERIFYING]: {
        stageKey: 'deals.stages.posted_verifying',
        shortLabel: 'Verifying post',
    },
    [DealEscrowStatus.COMPLETED]: {
        stageKey: 'deals.stages.released',
        shortLabel: 'Released',
    },
    [DealEscrowStatus.CANCELED]: {
        stageKey: 'deals.stages.canceled',
        shortLabel: 'Canceled',
    },
    [DealEscrowStatus.REFUNDED]: {
        stageKey: 'deals.stages.refunded',
        shortLabel: 'Refunded',
    },
    [DealEscrowStatus.DISPUTED]: {
        stageKey: 'deals.stages.disputed',
        shortLabel: 'Disputed',
    },
};

export function mapEscrowToPublicStage(
    escrow: DealEscrowStatus,
): DealPublicStage {
    return STAGE_MAP[escrow] ?? DEFAULT_STAGE;
}
