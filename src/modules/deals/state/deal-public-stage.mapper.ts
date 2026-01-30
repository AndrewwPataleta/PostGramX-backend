import {DealEscrowStatus} from '../types/deal-escrow-status.enum';

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
    [DealEscrowStatus.WAITING_SCHEDULE]: {
        stageKey: 'deals.stages.waiting_schedule',
        shortLabel: 'Choose time',
        actionHint: 'Select a posting date and time.',
    },
    [DealEscrowStatus.WAITING_CREATIVE]: {
        stageKey: 'deals.stages.waiting_creative',
        shortLabel: 'Send creative',
        actionHint: 'Send the post to the bot.',
    },
    [DealEscrowStatus.CREATIVE_SUBMITTED]: {
        stageKey: 'deals.stages.creative_submitted',
        shortLabel: 'Creative submitted',
        actionHint: 'Awaiting admin review.',
    },
    [DealEscrowStatus.ADMIN_REVIEW]: {
        stageKey: 'deals.stages.admin_review',
        shortLabel: 'Awaiting admin approval',
    },
    [DealEscrowStatus.CHANGES_REQUESTED]: {
        stageKey: 'deals.stages.changes_requested',
        shortLabel: 'Changes requested',
        actionHint: 'Resubmit the creative.',
    },
    [DealEscrowStatus.AWAITING_PAYMENT]: {
        stageKey: 'deals.stages.awaiting_payment',
        shortLabel: 'Awaiting payment',
        actionHint: 'Complete payment within the window.',
    },
    [DealEscrowStatus.PAYMENT_PENDING]: {
        stageKey: 'deals.stages.payment_pending',
        shortLabel: 'Payment processing',
    },
    [DealEscrowStatus.FUNDS_CONFIRMED]: {
        stageKey: 'deals.stages.funds_confirmed',
        shortLabel: 'Payment confirmed',
    },
    [DealEscrowStatus.SCHEDULED]: {
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
    [DealEscrowStatus.RELEASED]: {
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
