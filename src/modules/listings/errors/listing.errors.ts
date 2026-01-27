import {ServiceError} from '../../../core/service-error';

export enum ListingServiceErrorCode {
    CHANNEL_NOT_FOUND = 'CHANNEL_NOT_FOUND',
    UNAUTHORIZED_CHANNEL_ACCESS = 'UNAUTHORIZED_CHANNEL_ACCESS',
    CHANNEL_NOT_VERIFIED = 'CHANNEL_NOT_VERIFIED',
    INVALID_FORMAT = 'INVALID_FORMAT',
    INVALID_AVAILABILITY_RANGE = 'INVALID_AVAILABILITY_RANGE',
    INVALID_PIN_RULE = 'INVALID_PIN_RULE',
    TAGS_MISSING_REQUIRED = 'TAGS_MISSING_REQUIRED',
    INVALID_REQUIRES_APPROVAL = 'INVALID_REQUIRES_APPROVAL',
    INVALID_PRICE = 'INVALID_PRICE',
}

export class ListingServiceError extends ServiceError<ListingServiceErrorCode> {
    constructor(code: ListingServiceErrorCode) {
        super(code);
    }
}
