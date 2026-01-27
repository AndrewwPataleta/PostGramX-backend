import {ListingEntity} from '../entities/listing.entity';

export type ListingListItem = {
    id: string;
    channelId: string;
    format: string;
    priceNano: string;
    currency: string;
    availabilityFrom: Date;
    availabilityTo: Date;
    pinDurationHours: number | null;
    visibilityDurationHours: number;
    allowEdits: boolean;
    allowLinkTracking: boolean;
    allowPinnedPlacement: boolean;
    requiresApproval: boolean;
    contentRulesText: string;
    tags: string[];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
};

export const mapListingToListItem = (
    listing: ListingEntity,
): ListingListItem => ({
    id: listing.id,
    channelId: listing.channelId,
    format: listing.format,
    priceNano: listing.priceNano,
    currency: listing.currency,
    availabilityFrom: listing.availabilityFrom,
    availabilityTo: listing.availabilityTo,
    pinDurationHours: listing.pinDurationHours,
    visibilityDurationHours: listing.visibilityDurationHours,
    allowEdits: listing.allowEdits,
    allowLinkTracking: listing.allowLinkTracking,
    allowPinnedPlacement: listing.allowPinnedPlacement,
    requiresApproval: listing.requiresApproval,
    contentRulesText: listing.contentRulesText,
    tags: listing.tags,
    isActive: listing.isActive,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
});
