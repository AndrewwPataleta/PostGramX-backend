export enum PreDealErrorCode {
    PREDEAL_NOT_FOUND = 'PREDEAL_NOT_FOUND',
    LISTING_NOT_FOUND = 'LISTING_NOT_FOUND',
    LISTING_DISABLED = 'LISTING_DISABLED',
    INVALID_SCHEDULE_TIME = 'INVALID_SCHEDULE_TIME',
    SELF_DEAL_NOT_ALLOWED = 'SELF_DEAL_NOT_ALLOWED',
    UNAUTHORIZED_PREDEAL_ACCESS = 'UNAUTHORIZED_PREDEAL_ACCESS',
    INVALID_STATUS = 'INVALID_STATUS',
}

export class PreDealServiceError extends Error {
    constructor(public readonly code: PreDealErrorCode) {
        super(code);
    }
}
