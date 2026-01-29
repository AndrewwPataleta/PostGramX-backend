import {HttpStatus} from '@nestjs/common';
import {ListingServiceErrorCode} from './listing.errors';

export const mapListingErrorToStatus = (
    code: ListingServiceErrorCode,
): HttpStatus => {
    switch (code) {
        case ListingServiceErrorCode.CHANNEL_NOT_FOUND:
            return HttpStatus.NOT_FOUND;
        case ListingServiceErrorCode.UNAUTHORIZED_CHANNEL_ACCESS:
        case ListingServiceErrorCode.CHANNEL_NOT_VERIFIED:
        case ListingServiceErrorCode.LISTING_FORBIDDEN:
            return HttpStatus.FORBIDDEN;
        case ListingServiceErrorCode.LISTING_NOT_FOUND:
            return HttpStatus.NOT_FOUND;
        case ListingServiceErrorCode.INVALID_FORMAT:
        case ListingServiceErrorCode.INVALID_AVAILABILITY_RANGE:
        case ListingServiceErrorCode.INVALID_PIN_RULE:
        case ListingServiceErrorCode.TAGS_MISSING_REQUIRED:
        case ListingServiceErrorCode.INVALID_REQUIRES_APPROVAL:
        case ListingServiceErrorCode.INVALID_PRICE:
        case ListingServiceErrorCode.LISTING_UPDATE_INVALID:
        default:
            return HttpStatus.BAD_REQUEST;
    }
};

export const mapListingErrorToMessageKey = (
    code: ListingServiceErrorCode,
): string => {
    switch (code) {
        case ListingServiceErrorCode.CHANNEL_NOT_FOUND:
            return 'listings.errors.channelNotFound';
        case ListingServiceErrorCode.UNAUTHORIZED_CHANNEL_ACCESS:
            return 'listings.errors.unauthorized';
        case ListingServiceErrorCode.CHANNEL_NOT_VERIFIED:
            return 'listings.errors.channelNotVerified';
        case ListingServiceErrorCode.INVALID_FORMAT:
            return 'listings.errors.invalidFormat';
        case ListingServiceErrorCode.INVALID_AVAILABILITY_RANGE:
            return 'listings.errors.invalidAvailability';
        case ListingServiceErrorCode.INVALID_PIN_RULE:
            return 'listings.errors.invalidPinnedRule';
        case ListingServiceErrorCode.TAGS_MISSING_REQUIRED:
            return 'listings.errors.tagsMissingRequired';
        case ListingServiceErrorCode.INVALID_REQUIRES_APPROVAL:
            return 'listings.errors.invalidRequiresApproval';
        case ListingServiceErrorCode.INVALID_PRICE:
            return 'listings.errors.invalidPrice';
        case ListingServiceErrorCode.LISTING_NOT_FOUND:
            return 'listings.errors.notFound';
        case ListingServiceErrorCode.LISTING_FORBIDDEN:
            return 'listings.errors.forbidden';
        case ListingServiceErrorCode.LISTING_UPDATE_INVALID:
            return 'listings.errors.invalidUpdate';
        default:
            return 'listings.errors.invalidAvailability';
    }
};
