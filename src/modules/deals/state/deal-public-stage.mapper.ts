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
    [DealEscrowStatus.SCHEDULING_PENDING]: {
        stageKey: 'deals.stages.scheduling_pending',
        shortLabel: 'Choose time',
        actionHint: 'Select a posting date and time.',
    },
    [DealEscrowStatus.CREATIVE_AWAITING_SUBMIT]: {
        stageKey: 'deals.stages.creative_awaiting_submit',
        shortLabel: 'Send creative',
        actionHint: 'Send the post to the bot.',
    },
    [DealEscrowStatus.CREATIVE_AWAITING_CONFIRM]: {
        stageKey: 'deals.stages.creative_awaiting_confirm',
        shortLabel: 'Confirm creative',
        actionHint: 'Confirm the submitted creative.',
    },
    [DealEscrowStatus.ADMIN_REVIEW]: {
        stageKey: 'deals.stages.admin_review',
        shortLabel: 'Awaiting admin approval',
    },
    [DealEscrowStatus.PAYMENT_WINDOW_PENDING]: {
        stageKey: 'deals.stages.payment_window_pending',
        shortLabel: 'Choose payment window',
    },
    [DealEscrowStatus.PAYMENT_AWAITING]: {
        stageKey: 'deals.stages.payment_awaiting',
        shortLabel: 'Awaiting payment',
        actionHint: 'Complete payment within the window.',
    },
    [DealEscrowStatus.FUNDS_PENDING]: {
        stageKey: 'deals.stages.funds_pending',
        shortLabel: 'Payment processing',
    },
    [DealEscrowStatus.FUNDS_CONFIRMED]: {
        stageKey: 'deals.stages.funds_confirmed',
        shortLabel: 'Payment confirmed',
    },
    [DealEscrowStatus.CREATIVE_PENDING]: {
        stageKey: 'deals.stages.creative_pending',
        shortLabel: 'Creative edits needed',
    },
    [DealEscrowStatus.CREATIVE_REVIEW]: {
        stageKey: 'deals.stages.creative_review',
        shortLabel: 'Creative review',
    },
    [DealEscrowStatus.APPROVED_SCHEDULED]: {
        stageKey: 'deals.stages.approved_scheduled',
        shortLabel: 'Scheduled',
    },
    [DealEscrowStatus.POSTED_VERIFYING]: {
        stageKey: 'deals.stages.posted_verifying',
        shortLabel: 'Verifying post',
    },
    [DealEscrowStatus.COMPLETED]: {
        stageKey: 'deals.stages.completed',
        shortLabel: 'Completed',
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
