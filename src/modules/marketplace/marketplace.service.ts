import {BadRequestException, Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {ChannelEntity} from '../channels/entities/channel.entity';
import {
    ChannelMembershipEntity,
    TelegramAdminStatus,
} from '../channels/entities/channel-membership.entity';
import {ChannelStatus} from '../channels/types/channel-status.enum';
import {ChannelRole} from '../channels/types/channel-role.enum';
import {ListingEntity} from '../listings/entities/listing.entity';
import {MarketplaceListChannelsDataDto} from './dto/marketplace-list-channels.dto';
import {
    MarketplaceChannelItem,
    MarketplaceChannelsResponse,
} from './types/marketplace-channel-item.type';
import {CurrencyCode} from '../../common/constants/currency/currency.constants';
import {FeesService} from '../payments/fees/fees.service';

@Injectable()
export class MarketplaceService {
    constructor(
        @InjectRepository(ChannelEntity)
        private readonly channelRepository: Repository<ChannelEntity>,
        private readonly feesService: FeesService,
    ) {
    }

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
        const adminRoles = [ChannelRole.OWNER, ChannelRole.MODERATOR];
        const adminStatuses = [
            TelegramAdminStatus.CREATOR,
            TelegramAdminStatus.ADMINISTRATOR,
        ];

        const baseQuery = this.channelRepository
            .createQueryBuilder('channel')
            .leftJoin(
                ChannelMembershipEntity,
                'adminMembership',
                'adminMembership.channelId = channel.id AND adminMembership.userId = :userId AND adminMembership.isActive = true AND adminMembership.isManuallyDisabled = false AND (adminMembership.role IN (:...adminRoles) OR adminMembership.telegramAdminStatus IN (:...adminStatuses))',
                {
                    userId,
                    adminRoles,
                    adminStatuses,
                },
            )
            .innerJoin(
                ListingEntity,
                'listing',
                'listing.channelId = channel.id AND listing.isActive = true',
            )
            .where('channel.isDisabled = :isDisabled', {isDisabled: false})
            .andWhere('channel.ownerUserId != :userId', {userId})
            .andWhere('adminMembership.id IS NULL');

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
            .addSelect('channel.avatarUrl', 'avatarUrl')
            .addSelect('COUNT(listing.id)', 'placementsCount')
            .addSelect('MIN(listing.priceNano)', 'minPriceNano')
            .addSelect('jsonb_agg(listing.tags)', 'listingTags')
            .groupBy('channel.id');

        const rows = await query.getRawMany();
        const minPriceNano =
            filters.minPriceTon !== undefined
                ? BigInt(this.parseTonToNano(filters.minPriceTon))
                : null;
        const maxPriceNano =
            filters.maxPriceTon !== undefined
                ? BigInt(this.parseTonToNano(filters.maxPriceTon))
                : null;

        const withFinalPrice = await Promise.all(
            rows.map(async (row) => {
                const baseMinPrice = row.minPriceNano ?? '0';
                const priced = await this.feesService.computeFinalPriceNano({
                    baseAmountNano: baseMinPrice,
                    currency: CurrencyCode.TON,
                });
                return {
                    row,
                    finalMinPriceNano: priced.finalAmountNano,
                };
            }),
        );

        const filteredRows = withFinalPrice.filter((entry) => {
            const current = BigInt(entry.finalMinPriceNano);
            if (minPriceNano !== null && current < minPriceNano) {
                return false;
            }
            if (maxPriceNano !== null && current > maxPriceNano) {
                return false;
            }
            return true;
        });

        filteredRows.sort((left, right) => {
            if (sort === 'price_min') {
                const l = BigInt(left.finalMinPriceNano);
                const r = BigInt(right.finalMinPriceNano);
                if (l !== r) {
                    return order === 'asc' ? (l < r ? -1 : 1) : l > r ? -1 : 1;
                }
            } else if (sort === 'subscribers') {
                const l = Number(left.row.subscribers ?? -1);
                const r = Number(right.row.subscribers ?? -1);
                if (l !== r) {
                    return order === 'asc' ? l - r : r - l;
                }
            } else {
                const l = new Date(left.row.updatedAt).getTime();
                const r = new Date(right.row.updatedAt).getTime();
                if (l !== r) {
                    return order === 'asc' ? l - r : r - l;
                }
            }
            return right.row.id.localeCompare(left.row.id);
        });

        const total = filteredRows.length;
        const pagedRows = filteredRows.slice(offset, offset + limit);

        const items: MarketplaceChannelItem[] = pagedRows.map(({row, finalMinPriceNano}) => (
            {
                id: row.id,
                name: row.name,
                username: row.username,
                about: null,
                avatarUrl: row.avatarUrl,
                verified: row.status === ChannelStatus.VERIFIED,
                currency: CurrencyCode.TON,
                tags: this.normalizeAggregatedTags(row.listingTags),
                preview: {
                    listingCount: Number(row.placementsCount ?? 0),
                    subsCount: row.subscribers === null ? null : Number(row.subscribers),
                    listingFrom: this.formatNanoToTon(finalMinPriceNano),
                },
            }));

        return {
            items,
            page,
            limit,
            total,
        };
    }

    private formatNanoToTon(nano: string): string {
        const nanoValue = BigInt(nano);
        const whole = nanoValue / 1000000000n;
        const fraction = nanoValue % 1000000000n;
        if (fraction === 0n) {
            return whole.toString();
        }
        return `${whole.toString()}.${fraction
            .toString()
            .padStart(9, '0')
            .replace(/0+$/, '')}`;
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
