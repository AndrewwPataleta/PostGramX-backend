import {HttpStatus} from '@nestjs/common';
import {DealErrorCode} from '../../common/constants/errors/error-codes.constants';

export const mapDealErrorToStatus = (code: DealErrorCode): HttpStatus => {
    switch (code) {
        case DealErrorCode.DEAL_NOT_FOUND:
        case DealErrorCode.LISTING_NOT_FOUND:
            return HttpStatus.NOT_FOUND;
        case DealErrorCode.UNAUTHORIZED:
            return HttpStatus.FORBIDDEN;
        case DealErrorCode.INVALID_SCHEDULE_TIME:
        case DealErrorCode.LISTING_DISABLED:
        case DealErrorCode.SELF_DEAL_NOT_ALLOWED:
        case DealErrorCode.INVALID_STATUS:
        case DealErrorCode.ACTIVE_PENDING_LIMIT_REACHED:
        case DealErrorCode.DEADLINE_PASSED:
        case DealErrorCode.CREATIVE_NOT_SUBMITTED:
        case DealErrorCode.CREATIVE_NOT_RECEIVED:
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
        case DealErrorCode.UNAUTHORIZED:
            return 'deals.errors.unauthorized';
        case DealErrorCode.INVALID_SCHEDULE_TIME:
            return 'deals.errors.invalidScheduleTime';
        case DealErrorCode.INVALID_STATUS:
            return 'errors.deals.deal_not_actionable';
        case DealErrorCode.DEAL_NOT_FOUND:
            return 'deals.errors.dealNotFound';
        case DealErrorCode.SELF_DEAL_NOT_ALLOWED:
            return 'deals.errors.selfDealNotAllowed';
        case DealErrorCode.ACTIVE_PENDING_LIMIT_REACHED:
            return 'errors.deals.active_pending_limit';
        case DealErrorCode.DEADLINE_PASSED:
            return 'errors.deals.deadline_passed';
        case DealErrorCode.CREATIVE_NOT_SUBMITTED:
            return 'errors.deals.creative_not_submitted';
        case DealErrorCode.CREATIVE_NOT_RECEIVED:
            return 'errors.deals.creative_not_received';
        default:
            return 'errors.validation_failed';
    }
};
