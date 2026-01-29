import {ListingFormat} from '../../listings/entities/listing.entity';

export type PreDealListingSnapshot = {
    listingId: string;
    channelId: string;
    format: ListingFormat;
    priceNano: string;
    currency: string;
    tags: string[];
    pinDurationHours: number | null;
    visibilityDurationHours: number;
    allowEdits: boolean;
    allowLinkTracking: boolean;
    allowPinnedPlacement: boolean;
    requiresApproval: boolean;
    contentRulesText: string;
    version: number;
    snapshotAt: string;
};
