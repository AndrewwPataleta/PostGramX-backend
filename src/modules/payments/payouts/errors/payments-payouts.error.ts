export enum PaymentsPayoutsErrorCode {
    CHANNEL_NOT_FOUND = 'CHANNEL_NOT_FOUND',
    FORBIDDEN = 'FORBIDDEN',
    INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
    INVALID_AMOUNT = 'INVALID_AMOUNT',
    WITHDRAW_MINIMUM = 'WITHDRAW_MINIMUM',
}

export class PaymentsPayoutsError extends Error {
    constructor(public readonly code: PaymentsPayoutsErrorCode) {
        super(code);
    }
}
