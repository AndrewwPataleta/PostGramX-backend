import {HttpStatus} from '@nestjs/common';
import {PreDealErrorCode} from './errors/predeal-service.error';

export const mapPreDealErrorToStatus = (code: PreDealErrorCode): HttpStatus => {
    switch (code) {
        case PreDealErrorCode.PREDEAL_NOT_FOUND:
        case PreDealErrorCode.LISTING_NOT_FOUND:
            return HttpStatus.NOT_FOUND;
        case PreDealErrorCode.UNAUTHORIZED_PREDEAL_ACCESS:
            return HttpStatus.FORBIDDEN;
        case PreDealErrorCode.INVALID_SCHEDULE_TIME:
        case PreDealErrorCode.LISTING_DISABLED:
        case PreDealErrorCode.SELF_DEAL_NOT_ALLOWED:
        case PreDealErrorCode.INVALID_STATUS:
            return HttpStatus.BAD_REQUEST;
        default:
            return HttpStatus.BAD_REQUEST;
    }
};

export const mapPreDealErrorToMessageKey = (
    code: PreDealErrorCode,
): string => {
    switch (code) {
        case PreDealErrorCode.PREDEAL_NOT_FOUND:
            return 'predeals.errors.predealNotFound';
        case PreDealErrorCode.LISTING_NOT_FOUND:
            return 'predeals.errors.listingNotFound';
        case PreDealErrorCode.LISTING_DISABLED:
            return 'predeals.errors.listingDisabled';
        case PreDealErrorCode.INVALID_SCHEDULE_TIME:
            return 'predeals.errors.invalidScheduleTime';
        case PreDealErrorCode.SELF_DEAL_NOT_ALLOWED:
            return 'predeals.errors.selfDealNotAllowed';
        case PreDealErrorCode.UNAUTHORIZED_PREDEAL_ACCESS:
            return 'predeals.errors.unauthorized';
        case PreDealErrorCode.INVALID_STATUS:
            return 'predeals.errors.invalidStatus';
        default:
            return 'errors.validation_failed';
    }
};
