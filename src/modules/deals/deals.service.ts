import {Injectable, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Brackets, DataSource, Repository} from 'typeorm';
import {DealEntity} from './entities/deal.entity';
import {ListingEntity, ListingFormat} from '../listings/entities/listing.entity';
import {DealEscrowStatus} from './types/deal-escrow-status.enum';
import {DealInitiatorSide} from './types/deal-initiator-side.enum';
import {DealStatus} from './types/deal-status.enum';
import {DealErrorCode, DealServiceError} from './errors/deal-service.error';
import {ChannelEntity} from '../channels/entities/channel.entity';
import {DealsNotificationsService} from './deals-notifications.service';
import {ChannelMembershipEntity} from '../channels/entities/channel-membership.entity';
import {ChannelRole} from '../channels/types/channel-role.enum';
import {DealListingSnapshot} from './types/deal-listing-snapshot.type';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

const PENDING_ESCROW_STATUSES = [
    DealEscrowStatus.NEGOTIATING,
    DealEscrowStatus.AWAITING_PAYMENT,
    DealEscrowStatus.CREATIVE_PENDING,
    DealEscrowStatus.CREATIVE_REVIEW,
];

const ACTIVE_ESCROW_STATUSES = [
    DealEscrowStatus.FUNDS_CONFIRMED,
    DealEscrowStatus.APPROVED_SCHEDULED,
    DealEscrowStatus.POSTED_VERIFYING,
];

const COMPLETED_ESCROW_STATUSES = [
    DealEscrowStatus.COMPLETED,
    DealEscrowStatus.CANCELED,
    DealEscrowStatus.REFUNDED,
];

@Injectable()
export class DealsService {
    private readonly logger = new Logger(DealsService.name);

    constructor(
        private readonly dataSource: DataSource,
        @InjectRepository(DealEntity)
        private readonly dealRepository: Repository<DealEntity>,
        @InjectRepository(ListingEntity)
        private readonly listingRepository: Repository<ListingEntity>,
        @InjectRepository(ChannelEntity)
        private readonly channelRepository: Repository<ChannelEntity>,
        @InjectRepository(ChannelMembershipEntity)
        private readonly membershipRepository: Repository<ChannelMembershipEntity>,
        private readonly dealsNotificationsService: DealsNotificationsService,
    ) {}

    async createDeal(
        userId: string,
        listingId: string,
        brief?: string,
        scheduledAt?: string,
    ) {
        const listing = await this.listingRepository.findOne({
            where: {id: listingId},
        });

        if (!listing) {
            throw new DealServiceError(DealErrorCode.LISTING_NOT_FOUND);
        }

        if (!listing.isActive) {
            throw new DealServiceError(DealErrorCode.LISTING_DISABLED);
        }

        const channel = await this.channelRepository.findOne({
            where: {id: listing.channelId},
        });

        if (!channel) {
            throw new DealServiceError(DealErrorCode.LISTING_NOT_FOUND);
        }

        if (channel.createdByUserId === userId) {
            throw new DealServiceError(DealErrorCode.SELF_DEAL_NOT_ALLOWED);
        }

        if (listing.createdByUserId === userId) {
            throw new DealServiceError(DealErrorCode.SELF_DEAL_NOT_ALLOWED);
        }

        const hasActiveMembership =
            (await this.membershipRepository
                .createQueryBuilder('membership')
                .where('membership.channelId = :channelId', {
                    channelId: listing.channelId,
                })
                .andWhere('membership.userId = :userId', {userId})
                .andWhere('membership.isActive = true')
                .andWhere('membership.role IN (:...roles)', {
                    roles: [ChannelRole.OWNER, ChannelRole.MANAGER],
                })
                .getCount()) > 0;

        if (hasActiveMembership) {
            throw new DealServiceError(DealErrorCode.SELF_DEAL_NOT_ALLOWED);
        }

        const parsedScheduledAt = scheduledAt ? new Date(scheduledAt) : null;
        if (parsedScheduledAt && parsedScheduledAt.getTime() <= Date.now()) {
            throw new DealServiceError(DealErrorCode.INVALID_SCHEDULE_TIME);
        }

        const now = new Date();
        const listingSnapshot = this.buildListingSnapshot(listing, now);

        const deal = await this.dataSource.transaction(async (manager) => {
            const repo = manager.getRepository(DealEntity);
            const created = repo.create({
                listingId: listing.id,
                channelId: listing.channelId,
                advertiserUserId: userId,
                publisherOwnerUserId: channel.createdByUserId,
                createdByUserId: userId,
                sideInitiator: DealInitiatorSide.ADVERTISER,
                status: DealStatus.PENDING,
                escrowStatus: DealEscrowStatus.NEGOTIATING,
                offerSnapshot: {
                    priceNano: listing.priceNano,
                    currency: listing.currency,
                    format: listing.format,
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
                },
                listingSnapshot,
                brief: brief ?? null,
                scheduledAt: parsedScheduledAt,
                lastActivityAt: now,
            });

            return repo.save(created);
        });

        try {
            await this.dealsNotificationsService.notifyDealCreated(deal);
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            this.logger.warn(
                `Deal notification failed for dealId=${deal.id}: ${errorMessage}`,
            );
        }

        // TODO: notify when escrow status moves to verification/approval steps.

        return {
            id: deal.id,
            status: deal.status,
            escrowStatus: deal.escrowStatus,
            listingId: deal.listingId,
            channelId: deal.channelId,
            initiatorSide: deal.sideInitiator,
        };
    }

    async listDeals(
        userId: string,
        options: {
            role?: 'all' | 'advertiser' | 'publisher';
            pendingPage?: number;
            pendingLimit?: number;
            activePage?: number;
            activeLimit?: number;
            completedPage?: number;
            completedLimit?: number;
        },
    ) {
        const role = options.role ?? 'all';

        const pending = await this.fetchDealsGroup(userId, role, {
            page: options.pendingPage ?? DEFAULT_PAGE,
            limit: options.pendingLimit ?? DEFAULT_LIMIT,
            statuses: [DealStatus.PENDING],
            escrowStatuses: PENDING_ESCROW_STATUSES,
        });

        const active = await this.fetchDealsGroup(userId, role, {
            page: options.activePage ?? DEFAULT_PAGE,
            limit: options.activeLimit ?? DEFAULT_LIMIT,
            statuses: [DealStatus.ACTIVE],
            escrowStatuses: ACTIVE_ESCROW_STATUSES,
        });

        const completed = await this.fetchDealsGroup(userId, role, {
            page: options.completedPage ?? DEFAULT_PAGE,
            limit: options.completedLimit ?? DEFAULT_LIMIT,
            statuses: [DealStatus.COMPLETED, DealStatus.CANCELED],
            escrowStatuses: COMPLETED_ESCROW_STATUSES,
        });

        return {
            pending,
            active,
            completed,
        };
    }

    private async fetchDealsGroup(
        userId: string,
        role: 'all' | 'advertiser' | 'publisher',
        group: {
            page: number;
            limit: number;
            statuses: DealStatus[];
            escrowStatuses: DealEscrowStatus[];
        },
    ) {
        const qb = this.dealRepository
            .createQueryBuilder('deal')
            .leftJoinAndSelect('deal.listing', 'listing')
            .leftJoinAndSelect('deal.channel', 'channel')
            .orderBy('deal.lastActivityAt', 'DESC')
            .skip((group.page - 1) * group.limit)
            .take(group.limit);

        if (role === 'advertiser') {
            qb.where('deal.advertiserUserId = :userId', {userId});
        } else if (role === 'publisher') {
            qb.where('deal.publisherOwnerUserId = :userId', {userId});
        } else {
            qb.where(
                '(deal.advertiserUserId = :userId OR deal.publisherOwnerUserId = :userId)',
                {userId},
            );
        }

        qb.andWhere(
            new Brackets((builder) => {
                builder.where('deal.status IN (:...statuses)', {
                    statuses: group.statuses,
                });
                builder.orWhere(
                    'deal.status IS NULL AND deal.escrowStatus IN (:...escrowStatuses)',
                    {escrowStatuses: group.escrowStatuses},
                );
            }),
        );

        const [deals, total] = await qb.getManyAndCount();

        const items = deals.map((deal) => {
            const listing = deal.listing;
            const listingSnapshot = deal.listingSnapshot as
                | Partial<DealListingSnapshot>
                | null;
            const channel = deal.channel;

            const hasSnapshot = Boolean(
                listingSnapshot?.listingId && listingSnapshot?.priceNano,
            );

            return {
                id: deal.id,
                status: deal.status,
                escrowStatus: deal.escrowStatus,
                initiatorSide: deal.sideInitiator,
                userRoleInDeal:
                    deal.advertiserUserId === userId
                        ? 'advertiser'
                        : deal.publisherOwnerUserId === userId
                          ? 'publisher'
                          : 'unknown',
                channel: channel
                    ? {
                          id: channel.id,
                          name: channel.title,
                          username: channel.username,
                          avatarUrl: null,
                          verified: Boolean(channel.verifiedAt),
                      }
                    : null,
                listing: hasSnapshot
                    ? {
                          id: listingSnapshot?.listingId ?? '',
                          priceNano: listingSnapshot?.priceNano ?? '',
                          currency: listingSnapshot?.currency ?? '',
                          format:
                              listingSnapshot?.format ?? ListingFormat.POST,
                          tags: listingSnapshot?.tags ?? [],
                          pinDurationHours:
                              listingSnapshot?.pinDurationHours ?? null,
                          visibilityDurationHours:
                              listingSnapshot?.visibilityDurationHours ?? 0,
                          allowEdits: listingSnapshot?.allowEdits ?? false,
                          allowLinkTracking:
                              listingSnapshot?.allowLinkTracking ?? false,
                          contentRulesText:
                              listingSnapshot?.contentRulesText ?? '',
                      }
                    : listing
                      ? {
                            id: listing.id,
                            priceNano: listing.priceNano,
                            currency: listing.currency,
                            format: listing.format,
                            tags: listing.tags,
                            pinDurationHours: listing.pinDurationHours,
                            visibilityDurationHours:
                                listing.visibilityDurationHours,
                            allowEdits: listing.allowEdits,
                            allowLinkTracking: listing.allowLinkTracking,
                            contentRulesText: listing.contentRulesText,
                        }
                      : null,
                createdAt: deal.createdAt,
                lastActivityAt: deal.lastActivityAt,
                scheduledAt: deal.scheduledAt,
            };
        });

        return {
            items,
            page: group.page,
            limit: group.limit,
            total,
        };
    }

    private buildListingSnapshot(
        listing: ListingEntity,
        snapshotAt: Date,
    ): DealListingSnapshot {
        return {
            listingId: listing.id,
            channelId: listing.channelId,
            format: listing.format,
            priceNano: listing.priceNano,
            currency: listing.currency,
            tags: listing.tags,
            pinDurationHours: listing.pinDurationHours,
            visibilityDurationHours: listing.visibilityDurationHours,
            allowEdits: listing.allowEdits,
            allowLinkTracking: listing.allowLinkTracking,
            allowPinnedPlacement: listing.allowPinnedPlacement,
            requiresApproval: listing.requiresApproval,
            contentRulesText: listing.contentRulesText,
            version: listing.version ?? 1,
            snapshotAt: snapshotAt.toISOString(),
        };
    }
}
