import {BadRequestException, Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {ChannelEntity} from '../channels/entities/channel.entity';
import {ChannelStatus} from '../channels/types/channel-status.enum';
import {ListingEntity} from '../listings/entities/listing.entity';
import {MarketplaceListChannelsDataDto} from './dto/marketplace-list-channels.dto';
import {
    MarketplaceChannelItem,
    MarketplaceChannelsResponse,
} from './types/marketplace-channel-item.type';
import {CurrencyCode} from '../../common/constants/currency/currency.constants';

@Injectable()
export class MarketplaceService {
    constructor(
        @InjectRepository(ChannelEntity)
        private readonly channelRepository: Repository<ChannelEntity>,
    ) {}

    async listChannels(
        filters: MarketplaceListChannelsDataDto,
        userId: string,
    ): Promise<MarketplaceChannelsResponse> {
        const page = filters.page ?? 1;
        const limit = Math.min(filters.limit ?? 20, 50);
        const offset = (page - 1) * limit;
        const sort = filters.sort ?? 'recent';
        const order =
            filters.order ?? (sort === 'price_min' ? 'asc' : 'desc');
        const verifiedOnly = filters.verifiedOnly ?? true;

        const baseQuery = this.channelRepository
            .createQueryBuilder('channel')
            .innerJoin(
                ListingEntity,
                'listing',
                'listing.channelId = channel.id AND listing.isActive = true',
            )
            .where('channel.isDisabled = :isDisabled', {isDisabled: false})
            .andWhere('channel.createdByUserId != :userId', {userId});

        if (verifiedOnly) {
            baseQuery.andWhere('channel.status = :status', {
                status: ChannelStatus.VERIFIED,
            });
        }

        if (filters.q) {
            baseQuery.andWhere(
                '(channel.title ILIKE :query OR channel.username ILIKE :query)',
                {query: `%${filters.q}%`},
            );
        }

        if (filters.tags && filters.tags.length > 0) {
            baseQuery.andWhere('listing.tags && :tags', {tags: filters.tags});
        }

        if (filters.minSubscribers !== undefined) {
            baseQuery.andWhere('channel.subscribersCount >= :minSubscribers', {
                minSubscribers: filters.minSubscribers,
            });
        }

        if (filters.maxSubscribers !== undefined) {
            baseQuery.andWhere('channel.subscribersCount <= :maxSubscribers', {
                maxSubscribers: filters.maxSubscribers,
            });
        }

        if (filters.minPriceTon !== undefined) {
            const minPriceNano = this.parseTonToNano(filters.minPriceTon);
            baseQuery.andWhere('listing.priceNano >= :minPriceNano', {
                minPriceNano,
            });
        }

        if (filters.maxPriceTon !== undefined) {
            const maxPriceNano = this.parseTonToNano(filters.maxPriceTon);
            baseQuery.andWhere('listing.priceNano <= :maxPriceNano', {
                maxPriceNano,
            });
        }

        const totalResult = await baseQuery
            .clone()
            .select('COUNT(DISTINCT channel.id)', 'total')
            .getRawOne<{total: string}>();
        const total = Number(totalResult?.total ?? 0);

        const query = baseQuery
            .clone()
            .select([
                'channel.id AS id',
                'channel.title AS name',
                'channel.username AS username',
                'channel.status AS status',
                'channel.subscribersCount AS subscribers',
                'channel.updatedAt AS updatedAt',
            ])
            .addSelect('COUNT(listing.id)', 'placementsCount')
            .addSelect('MIN(listing.priceNano)', 'minPriceNano')
            .addSelect('jsonb_agg(listing.tags)', 'listingTags')
            .groupBy('channel.id');

        switch (sort) {
            case 'price_min':
                query.orderBy(
                    'minPriceNano',
                    order.toUpperCase() as 'ASC' | 'DESC',
                );
                break;
            case 'subscribers':
                query.orderBy(
                    'channel.subscribersCount',
                    order.toUpperCase() as 'ASC' | 'DESC',
                    'NULLS LAST',
                );
                break;
            case 'recent':
            default:
                query.orderBy(
                    'channel.updatedAt',
                    order.toUpperCase() as 'ASC' | 'DESC',
                );
                break;
        }

        query.addOrderBy('channel.id', 'DESC');
        query.skip(offset).take(limit);

        const rows = await query.getRawMany();

        const items: MarketplaceChannelItem[] = rows.map((row) => ({
            id: row.id,
            name: row.name,
            username: row.username,
            about: null,
            avatarUrl: null,
            verified: row.status === ChannelStatus.VERIFIED,
            subscribers: row.subscribers === null ? null : Number(row.subscribers),
            placementsCount: Number(row.placementsCount ?? 0),
            minPriceNano: row.minPriceNano ?? '0',
            currency: CurrencyCode.TON,
            tags: this.normalizeAggregatedTags(row.listingTags),
        }));

        return {
            items,
            page,
            limit,
            total,
        };
    }

    private parseTonToNano(value: number): string {
        if (!Number.isFinite(value) || value < 0) {
            throw new BadRequestException('Invalid price filter.');
        }

        let normalized = value.toString();
        if (normalized.includes('e') || normalized.includes('E')) {
            normalized = value.toFixed(9);
        }

        normalized = normalized.replace(/(\.\d*?)0+$/, '$1');
        normalized = normalized.replace(/\.$/, '');

        const match = /^(\d+)(?:\.(\d{1,9}))?$/.exec(normalized);
        if (!match) {
            throw new BadRequestException('Invalid price filter.');
        }

        const wholePart = match[1];
        const fractionPart = match[2] ?? '';
        if (fractionPart.length > 9) {
            throw new BadRequestException('Invalid price filter.');
        }

        const fractionPadded = fractionPart.padEnd(9, '0');
        const nano = BigInt(wholePart) * 1000000000n +
            BigInt(fractionPadded || '0');

        if (nano < 0n) {
            throw new BadRequestException('Invalid price filter.');
        }

        return nano.toString();
    }

    private normalizeAggregatedTags(value: unknown): string[] {
        let parsed: unknown = value;

        if (typeof parsed === 'string') {
            try {
                parsed = JSON.parse(parsed);
            } catch {
                parsed = [];
            }
        }

        if (!Array.isArray(parsed)) {
            return [];
        }

        const flattened: string[] = [];
        for (const entry of parsed) {
            if (Array.isArray(entry)) {
                for (const tag of entry) {
                    if (typeof tag === 'string') {
                        flattened.push(tag);
                    }
                }
            } else if (typeof entry === 'string') {
                flattened.push(entry);
            }
        }

        const unique = new Map<string, string>();
        for (const tag of flattened) {
            const trimmed = tag.trim();
            if (!trimmed) {
                continue;
            }
            const key = trimmed.toLowerCase();
            if (!unique.has(key)) {
                unique.set(key, trimmed);
            }
        }

        return Array.from(unique.values());
    }
}
