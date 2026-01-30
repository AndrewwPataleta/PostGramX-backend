import {PaymentsPayoutsErrorCode} from './payments-payouts.error';

export function mapPaymentsPayoutsErrorToStatus(
    code: PaymentsPayoutsErrorCode,
): number {
    switch (code) {
        case PaymentsPayoutsErrorCode.CHANNEL_NOT_FOUND:
            return 404;
        case PaymentsPayoutsErrorCode.FORBIDDEN:
            return 403;
        case PaymentsPayoutsErrorCode.INVALID_AMOUNT:
        case PaymentsPayoutsErrorCode.WITHDRAW_MINIMUM:
        case PaymentsPayoutsErrorCode.INSUFFICIENT_FUNDS:
            return 400;
        default:
            return 400;
    }
}

export function mapPaymentsPayoutsErrorToMessageKey(
    code: PaymentsPayoutsErrorCode,
): string {
    switch (code) {
        case PaymentsPayoutsErrorCode.CHANNEL_NOT_FOUND:
            return 'payments.errors.channel_not_found';
        case PaymentsPayoutsErrorCode.FORBIDDEN:
            return 'payments.errors.forbidden';
        case PaymentsPayoutsErrorCode.INVALID_AMOUNT:
            return 'payments.errors.invalid_amount';
        case PaymentsPayoutsErrorCode.WITHDRAW_MINIMUM:
            return 'payments.errors.withdraw_minimum';
        case PaymentsPayoutsErrorCode.INSUFFICIENT_FUNDS:
            return 'payments.errors.insufficient_funds';
        default:
            return 'payments.errors.invalid_amount';
    }
}
