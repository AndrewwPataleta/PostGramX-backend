import {BalanceErrorCode} from './balance-service.error';

export function mapBalanceErrorToStatus(code: BalanceErrorCode): number {
    switch (code) {
        case BalanceErrorCode.CURRENCY_UNSUPPORTED:
            return 400;
        default:
            return 400;
    }
}

export function mapBalanceErrorToMessageKey(code: BalanceErrorCode): string {
    switch (code) {
        case BalanceErrorCode.CURRENCY_UNSUPPORTED:
            return 'errors.balance.currency_unsupported';
        default:
            return 'errors.validation_failed';
    }
}
