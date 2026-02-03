export enum PaymentsPayoutsErrorCode {
    CHANNEL_NOT_FOUND = 'CHANNEL_NOT_FOUND',
    FORBIDDEN = 'FORBIDDEN',
    INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
    INVALID_AMOUNT = 'INVALID_AMOUNT',
    INVALID_DESTINATION = 'INVALID_DESTINATION',
    WITHDRAW_MINIMUM = 'WITHDRAW_MINIMUM',
    WITHDRAW_FAILED = 'WITHDRAW_FAILED',
}

export class PaymentsPayoutsError extends Error {
    constructor(public readonly code: PaymentsPayoutsErrorCode) {
        super(code);
    }
}
