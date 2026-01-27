import {EscrowServiceErrorCode} from './escrow-service.error';

export function mapEscrowErrorToStatus(code: EscrowServiceErrorCode): number {
    switch (code) {
        case EscrowServiceErrorCode.DEAL_NOT_FOUND:
            return 404;
        case EscrowServiceErrorCode.FORBIDDEN:
            return 403;
        case EscrowServiceErrorCode.INVALID_TRANSITION:
            return 400;
        case EscrowServiceErrorCode.ESCROW_ALREADY_INITIALIZED:
        case EscrowServiceErrorCode.ESCROW_AMOUNT_MISMATCH:
        case EscrowServiceErrorCode.ESCROW_WALLET_MISSING:
            return 409;
        case EscrowServiceErrorCode.ESCROW_AMOUNT_NOT_SET:
            return 400;
        case EscrowServiceErrorCode.MOCK_DISABLED:
            return 403;
        default:
            return 400;
    }
}

export function mapEscrowErrorToMessageKey(
    code: EscrowServiceErrorCode,
): string {
    switch (code) {
        case EscrowServiceErrorCode.DEAL_NOT_FOUND:
            return 'payments.errors.deal_not_found';
        case EscrowServiceErrorCode.FORBIDDEN:
            return 'payments.errors.forbidden';
        case EscrowServiceErrorCode.INVALID_TRANSITION:
            return 'payments.errors.invalid_transition';
        case EscrowServiceErrorCode.ESCROW_ALREADY_INITIALIZED:
            return 'payments.errors.escrow_already_initialized';
        case EscrowServiceErrorCode.ESCROW_AMOUNT_MISMATCH:
            return 'payments.errors.escrow_amount_mismatch';
        case EscrowServiceErrorCode.ESCROW_WALLET_MISSING:
            return 'payments.errors.escrow_wallet_missing';
        case EscrowServiceErrorCode.ESCROW_AMOUNT_NOT_SET:
            return 'payments.errors.escrow_amount_missing';
        case EscrowServiceErrorCode.MOCK_DISABLED:
            return 'payments.errors.mock_disabled';
        default:
            return 'errors.validation_failed';
    }
}
