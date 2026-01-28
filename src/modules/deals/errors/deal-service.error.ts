export enum DealErrorCode {
    DEAL_NOT_FOUND = 'DEAL_NOT_FOUND',
    LISTING_NOT_FOUND = 'LISTING_NOT_FOUND',
    LISTING_DISABLED = 'LISTING_DISABLED',
    UNAUTHORIZED_DEAL_ACCESS = 'UNAUTHORIZED_DEAL_ACCESS',
    INVALID_SCHEDULE_TIME = 'INVALID_SCHEDULE_TIME',
    SELF_DEAL_NOT_ALLOWED = 'SELF_DEAL_NOT_ALLOWED',
}

export class DealServiceError extends Error {
    constructor(public readonly code: DealErrorCode) {
        super(code);
    }
}
