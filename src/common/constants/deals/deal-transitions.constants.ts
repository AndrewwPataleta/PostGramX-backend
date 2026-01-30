import {DealEscrowStatus} from './deal-escrow-status.constants';

export const DEAL_ESCROW_TRANSITIONS: Record<DealEscrowStatus, DealEscrowStatus[]> = {
    [DealEscrowStatus.DRAFT]: [
        DealEscrowStatus.SCHEDULING_PENDING,
        DealEscrowStatus.CANCELED,
    ],
    [DealEscrowStatus.SCHEDULING_PENDING]: [
        DealEscrowStatus.CREATIVE_AWAITING_SUBMIT,
    ],
    [DealEscrowStatus.CREATIVE_AWAITING_ADMIN_REVIEW]: [
        DealEscrowStatus.CREATIVE_AWAITING_SUBMIT,
    ],
    [DealEscrowStatus.CREATIVE_AWAITING_SUBMIT]: [
        DealEscrowStatus.CREATIVE_AWAITING_ADMIN_REVIEW,
    ],
    [DealEscrowStatus.AWAITING_PAYMENT]: [
        DealEscrowStatus.FUNDS_PENDING,
    ],
    [DealEscrowStatus.FUNDS_PENDING]: [
        DealEscrowStatus.FUNDS_CONFIRMED,
        DealEscrowStatus.REFUNDED,
    ],
    [DealEscrowStatus.FUNDS_CONFIRMED]: [
        DealEscrowStatus.CREATIVE_PENDING,
        DealEscrowStatus.APPROVED_SCHEDULED,
        DealEscrowStatus.DISPUTED,
    ],
    [DealEscrowStatus.CREATIVE_PENDING]: [
        DealEscrowStatus.CREATIVE_REVIEW,
        DealEscrowStatus.DISPUTED,
    ],
    [DealEscrowStatus.CREATIVE_REVIEW]: [
        DealEscrowStatus.APPROVED_SCHEDULED,
        DealEscrowStatus.DISPUTED,
    ],
    [DealEscrowStatus.APPROVED_SCHEDULED]: [
        DealEscrowStatus.POSTING,
        DealEscrowStatus.POSTED_VERIFYING,
        DealEscrowStatus.DISPUTED,
    ],
    [DealEscrowStatus.POSTING]: [
        DealEscrowStatus.POSTED_VERIFYING,
        DealEscrowStatus.DISPUTED,
    ],
    [DealEscrowStatus.POSTED_VERIFYING]: [
        DealEscrowStatus.COMPLETED,
        DealEscrowStatus.DISPUTED,
    ],
    [DealEscrowStatus.COMPLETED]: [],
    [DealEscrowStatus.CANCELED]: [],
    [DealEscrowStatus.REFUNDED]: [],
    [DealEscrowStatus.DISPUTED]: [],
};
