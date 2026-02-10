import {CurrencyCode} from '../../../common/constants/currency/currency.constants';

export type MarketplaceChannelItem = {
    id: string;
    name: string;
    username: string | null;
    about: string | null;
    avatarUrl: string | null;
    verified: boolean;
    subscribers: number | null;
    subscribersCount?: number | null;
    avgViews?: number | null;
    lastPostsPreview?: Array<Record<string, unknown>> | null;
    analyticsUpdatedAt?: Date | null;
    placementsCount: number;
    minPriceNano: string;
    currency: CurrencyCode;
    tags: string[];
    preview: {
        listingCount: number;
        subsCount: number | null;
        listingFrom: string | null;
    };
};

export type MarketplaceChannelsResponse = {
    items: MarketplaceChannelItem[];
    page: number;
    limit: number;
    total: number;
};
