import {CurrencyCode} from '../../../common/constants/currency/currency.constants';

export type MarketplaceChannelItem = {
    id: string;
    name: string;
    username: string | null;
    about: string | null;
    avatarUrl: string | null;
    verified: boolean;
    subscribers: number | null;
    placementsCount: number;
    minPriceNano: string;
    currency: CurrencyCode;
    tags: string[];
};

export type MarketplaceChannelsResponse = {
    items: MarketplaceChannelItem[];
    page: number;
    limit: number;
    total: number;
};
