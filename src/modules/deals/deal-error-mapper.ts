import {HttpStatus} from '@nestjs/common';
import {DealErrorCode} from './errors/deal-service.error';

export const mapDealErrorToStatus = (code: DealErrorCode): HttpStatus => {
    switch (code) {
        case DealErrorCode.DEAL_NOT_FOUND:
        case DealErrorCode.LISTING_NOT_FOUND:
            return HttpStatus.NOT_FOUND;
        case DealErrorCode.UNAUTHORIZED_DEAL_ACCESS:
            return HttpStatus.FORBIDDEN;
        case DealErrorCode.INVALID_SCHEDULE_TIME:
        case DealErrorCode.LISTING_DISABLED:
            return HttpStatus.BAD_REQUEST;
        default:
            return HttpStatus.BAD_REQUEST;
    }
};

export const mapDealErrorToMessageKey = (code: DealErrorCode): string => {
    switch (code) {
        case DealErrorCode.LISTING_NOT_FOUND:
            return 'deals.errors.listingNotFound';
        case DealErrorCode.LISTING_DISABLED:
            return 'deals.errors.listingDisabled';
        case DealErrorCode.UNAUTHORIZED_DEAL_ACCESS:
            return 'deals.errors.unauthorized';
        case DealErrorCode.INVALID_SCHEDULE_TIME:
            return 'deals.errors.invalidScheduleTime';
        case DealErrorCode.DEAL_NOT_FOUND:
            return 'deals.errors.dealNotFound';
        default:
            return 'errors.validation_failed';
    }
};
