import {PayoutErrorCode} from './payout-service.error';

export function mapPayoutErrorToStatus(code: PayoutErrorCode): number {
    switch (code) {
        case PayoutErrorCode.WALLET_NOT_CONNECTED:
            return 400;
        case PayoutErrorCode.INVALID_AMOUNT:
            return 400;
        case PayoutErrorCode.INSUFFICIENT_BALANCE:
            return 400;
        case PayoutErrorCode.INSUFFICIENT_LIQUIDITY:
            return 409;
        case PayoutErrorCode.PAYOUT_ALREADY_IN_PROGRESS:
            return 409;
        case PayoutErrorCode.INTERNAL_ERROR:
        default:
            return 500;
    }
}

export function mapPayoutErrorToMessageKey(code: PayoutErrorCode): string {
    switch (code) {
        case PayoutErrorCode.WALLET_NOT_CONNECTED:
            return 'payments.errors.wallet_not_connected';
        case PayoutErrorCode.INVALID_AMOUNT:
            return 'payments.errors.invalid_amount';
        case PayoutErrorCode.INSUFFICIENT_BALANCE:
            return 'payments.errors.insufficient_funds';
        case PayoutErrorCode.INSUFFICIENT_LIQUIDITY:
            return 'payments.errors.insufficient_liquidity';
        case PayoutErrorCode.PAYOUT_ALREADY_IN_PROGRESS:
            return 'payments.errors.payout_already_in_progress';
        case PayoutErrorCode.INTERNAL_ERROR:
        default:
            return 'payments.errors.internal_error';
    }
}
