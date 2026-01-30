import {Injectable, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Brackets, DataSource, In, Repository} from 'typeorm';
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
import {mapEscrowToDealStatus} from './state/deal-status.mapper';
import {assertTransitionAllowed, DealStateError} from './state/deal-state.machine';
import {DEALS_CONFIG} from '../../config/deals.config';
import {User} from '../auth/entities/user.entity';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

const PENDING_ESCROW_STATUSES = [
    DealEscrowStatus.DRAFT,
    DealEscrowStatus.SCHEDULING_PENDING,
    DealEscrowStatus.CREATIVE_AWAITING_SUBMIT,
    DealEscrowStatus.CREATIVE_AWAITING_CONFIRM,
    DealEscrowStatus.ADMIN_REVIEW,
    DealEscrowStatus.PAYMENT_WINDOW_PENDING,
    DealEscrowStatus.PAYMENT_AWAITING,
    DealEscrowStatus.FUNDS_PENDING,
];

const ACTIVE_ESCROW_STATUSES = [
    DealEscrowStatus.FUNDS_CONFIRMED,
    DealEscrowStatus.CREATIVE_PENDING,
    DealEscrowStatus.CREATIVE_REVIEW,
    DealEscrowStatus.APPROVED_SCHEDULED,
    DealEscrowStatus.POSTED_VERIFYING,
];

const COMPLETED_ESCROW_STATUSES = [
    DealEscrowStatus.COMPLETED,
    DealEscrowStatus.CANCELED,
    DealEscrowStatus.REFUNDED,
    DealEscrowStatus.DISPUTED,
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
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
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

        const activePendingCount = await this.dealRepository.count({
            where: {
                listingId,
                advertiserUserId: userId,
                status: DealStatus.PENDING,
                escrowStatus: In(PENDING_ESCROW_STATUSES),
            },
        });

        if (
            activePendingCount >=
            DEALS_CONFIG.MAX_ACTIVE_PENDING_DEALS_PER_LISTING_PER_USER
        ) {
            throw new DealServiceError(
                DealErrorCode.ACTIVE_PENDING_LIMIT_REACHED,
            );
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
        const escrowStatus = parsedScheduledAt
            ? DealEscrowStatus.CREATIVE_AWAITING_SUBMIT
            : DealEscrowStatus.SCHEDULING_PENDING;
        const idleExpiresAt = this.addMinutes(
            now,
            DEALS_CONFIG.DEAL_IDLE_EXPIRE_MINUTES,
        );
        const creativeDeadlineAt = parsedScheduledAt
            ? this.addMinutes(now, DEALS_CONFIG.CREATIVE_SUBMIT_DEADLINE_MINUTES)
            : null;

        const deal = await this.dataSource.transaction(async (manager) => {
            const repo = manager.getRepository(DealEntity);
            const created = repo.create({
                listingId: listing.id,
                channelId: listing.channelId,
                advertiserUserId: userId,
                publisherOwnerUserId: channel.createdByUserId,
                createdByUserId: userId,
                sideInitiator: DealInitiatorSide.ADVERTISER,
                status: mapEscrowToDealStatus(escrowStatus),
                escrowStatus,
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
                idleExpiresAt,
                creativeDeadlineAt,
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

    async scheduleDeal(userId: string, dealId: string, scheduledAt: string) {
        const deal = await this.dealRepository.findOne({where: {id: dealId}});

        if (!deal) {
            throw new DealServiceError(DealErrorCode.DEAL_NOT_FOUND);
        }

        if (deal.advertiserUserId !== userId) {
            throw new DealServiceError(DealErrorCode.UNAUTHORIZED_DEAL_ACCESS);
        }

        const parsedScheduledAt = new Date(scheduledAt);
        if (parsedScheduledAt.getTime() <= Date.now()) {
            throw new DealServiceError(DealErrorCode.INVALID_SCHEDULE_TIME);
        }

        this.ensureTransitionAllowed(
            deal.escrowStatus,
            DealEscrowStatus.CREATIVE_AWAITING_SUBMIT,
        );

        const now = new Date();
        const escrowStatus = DealEscrowStatus.CREATIVE_AWAITING_SUBMIT;
        const creativeDeadlineAt = this.addMinutes(
            now,
            DEALS_CONFIG.CREATIVE_SUBMIT_DEADLINE_MINUTES,
        );

        await this.dealRepository.update(deal.id, {
            scheduledAt: parsedScheduledAt,
            escrowStatus,
            status: mapEscrowToDealStatus(escrowStatus),
            creativeDeadlineAt,
            ...this.buildActivityUpdate(now),
        });

        return {
            id: deal.id,
            status: mapEscrowToDealStatus(escrowStatus),
            escrowStatus,
            scheduledAt: parsedScheduledAt,
        };
    }

    async confirmCreativeSent(userId: string, dealId: string) {
        const deal = await this.dealRepository.findOne({where: {id: dealId}});

        if (!deal) {
            throw new DealServiceError(DealErrorCode.DEAL_NOT_FOUND);
        }

        if (deal.advertiserUserId !== userId) {
            throw new DealServiceError(DealErrorCode.UNAUTHORIZED_DEAL_ACCESS);
        }

        const escrowStatus = DealEscrowStatus.CREATIVE_AWAITING_CONFIRM;
        this.ensureTransitionAllowed(deal.escrowStatus, escrowStatus);

        const now = new Date();
        await this.dealRepository.update(deal.id, {
            escrowStatus,
            status: mapEscrowToDealStatus(escrowStatus),
            ...this.buildActivityUpdate(now),
        });

        return {
            id: deal.id,
            status: mapEscrowToDealStatus(escrowStatus),
            escrowStatus,
        };
    }

    async recordCreativeSubmission(payload: {
        userId: string;
        dealId: string;
        messageId: string;
        messageText: string | null;
        creativePayload: Record<string, unknown> | null;
    }) {
        const deal = await this.dealRepository.findOne({
            where: {id: payload.dealId},
        });

        if (!deal) {
            throw new DealServiceError(DealErrorCode.DEAL_NOT_FOUND);
        }

        if (deal.advertiserUserId !== payload.userId) {
            throw new DealServiceError(DealErrorCode.UNAUTHORIZED_DEAL_ACCESS);
        }

        const escrowStatus = DealEscrowStatus.ADMIN_REVIEW;
        this.ensureTransitionAllowed(deal.escrowStatus, escrowStatus);

        const now = new Date();
        const adminReviewDeadlineAt = this.addHours(
            now,
            DEALS_CONFIG.ADMIN_RESPONSE_DEADLINE_HOURS,
        );

        await this.dealRepository.update(deal.id, {
            escrowStatus,
            status: mapEscrowToDealStatus(escrowStatus),
            creativeMessageId: payload.messageId,
            creativeText: payload.messageText,
            creativePayload: payload.creativePayload,
            creativeSubmittedAt: now,
            adminReviewComment: null,
            adminReviewNotifiedAt: now,
            adminReviewDeadlineAt,
            creativeDeadlineAt: null,
            ...this.buildActivityUpdate(now),
        });

        const updated = await this.dealRepository.findOne({
            where: {id: deal.id},
        });
        if (updated) {
            try {
                await this.dealsNotificationsService.notifyDealActionRequired(
                    updated,
                    'approval',
                );
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : String(error);
                this.logger.warn(
                    `Deal admin notification failed for dealId=${deal.id}: ${errorMessage}`,
                );
            }
        }

        return {
            id: deal.id,
            status: mapEscrowToDealStatus(escrowStatus),
            escrowStatus,
        };
    }

    async handleCreativeMessage(payload: {
        telegramUserId: string;
        chatId: string;
        dealId: string;
        messageId: string;
        text: string | null;
        attachments: Array<Record<string, unknown>> | null;
    }): Promise<{handled: boolean; message?: string}> {
        if (!payload.dealId) {
            return {handled: false};
        }

        const user = await this.userRepository.findOne({
            where: {telegramId: payload.telegramUserId},
        });

        if (!user) {
            return {
                handled: true,
                message: 'Please sign in to PostGramX before submitting creative.',
            };
        }

        try {
            await this.recordCreativeSubmission({
                userId: user.id,
                dealId: payload.dealId,
                messageId: payload.messageId,
                messageText: payload.text,
                creativePayload: {
                    telegramChatId: payload.chatId,
                    attachments: payload.attachments ?? [],
                },
            });
        } catch (error) {
            if (error instanceof DealServiceError) {
                switch (error.code) {
                    case DealErrorCode.DEAL_NOT_FOUND:
                        return {handled: true, message: 'Deal not found.'};
                    case DealErrorCode.UNAUTHORIZED_DEAL_ACCESS:
                        return {
                            handled: true,
                            message: 'You are not the advertiser for this deal.',
                        };
                    case DealErrorCode.INVALID_TRANSITION:
                        return {
                            handled: true,
                            message:
                                'This deal is not ready to accept creative right now.',
                        };
                    default:
                        return {handled: true, message: 'Unable to attach creative.'};
                }
            }
            throw error;
        }

        return {
            handled: true,
            message:
                '✅ Creative received. We have notified the channel admins for review.',
        };
    }

    async approveByAdmin(userId: string, dealId: string) {
        const deal = await this.dealRepository.findOne({where: {id: dealId}});

        if (!deal) {
            throw new DealServiceError(DealErrorCode.DEAL_NOT_FOUND);
        }

        if (deal.publisherOwnerUserId !== userId) {
            throw new DealServiceError(DealErrorCode.UNAUTHORIZED_DEAL_ACCESS);
        }

        const escrowStatus = DealEscrowStatus.PAYMENT_WINDOW_PENDING;
        this.ensureTransitionAllowed(deal.escrowStatus, escrowStatus);

        const now = new Date();
        const paymentDeadlineAt = this.addMinutes(
            now,
            DEALS_CONFIG.PAYMENT_DEADLINE_MINUTES,
        );
        await this.dealRepository.update(deal.id, {
            escrowStatus,
            status: mapEscrowToDealStatus(escrowStatus),
            approvedAt: now,
            paymentDeadlineAt,
            adminReviewDeadlineAt: null,
            ...this.buildActivityUpdate(now),
        });

        try {
            await this.dealsNotificationsService.notifyDealActionRequired(
                deal,
                'payment',
            );
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            this.logger.warn(
                `Deal payment notification failed for dealId=${deal.id}: ${errorMessage}`,
            );
        }

        return {
            id: deal.id,
            status: mapEscrowToDealStatus(escrowStatus),
            escrowStatus,
        };
    }

    async requestChangesByAdmin(
        userId: string,
        dealId: string,
        comment?: string,
    ) {
        const deal = await this.dealRepository.findOne({where: {id: dealId}});

        if (!deal) {
            throw new DealServiceError(DealErrorCode.DEAL_NOT_FOUND);
        }

        if (deal.publisherOwnerUserId !== userId) {
            throw new DealServiceError(DealErrorCode.UNAUTHORIZED_DEAL_ACCESS);
        }

        const escrowStatus = DealEscrowStatus.CREATIVE_AWAITING_SUBMIT;
        this.ensureTransitionAllowed(deal.escrowStatus, escrowStatus);

        const now = new Date();
        const creativeDeadlineAt = this.addMinutes(
            now,
            DEALS_CONFIG.CREATIVE_SUBMIT_DEADLINE_MINUTES,
        );
        await this.dealRepository.update(deal.id, {
            escrowStatus,
            status: mapEscrowToDealStatus(escrowStatus),
            adminReviewComment: comment ?? null,
            creativeDeadlineAt,
            adminReviewDeadlineAt: null,
            adminReviewNotifiedAt: null,
            ...this.buildActivityUpdate(now),
        });

        return {
            id: deal.id,
            status: mapEscrowToDealStatus(escrowStatus),
            escrowStatus,
        };
    }

    async rejectByAdmin(userId: string, dealId: string, reason?: string) {
        const deal = await this.dealRepository.findOne({where: {id: dealId}});

        if (!deal) {
            throw new DealServiceError(DealErrorCode.DEAL_NOT_FOUND);
        }

        if (deal.publisherOwnerUserId !== userId) {
            throw new DealServiceError(DealErrorCode.UNAUTHORIZED_DEAL_ACCESS);
        }

        const escrowStatus = DealEscrowStatus.CANCELED;
        this.ensureTransitionAllowed(deal.escrowStatus, escrowStatus);

        const now = new Date();
        await this.dealRepository.update(deal.id, {
            escrowStatus,
            status: mapEscrowToDealStatus(escrowStatus),
            cancelReason: reason ?? 'ADMIN_REJECTED',
            ...this.buildActivityUpdate(now),
        });

        return {
            id: deal.id,
            status: mapEscrowToDealStatus(escrowStatus),
            escrowStatus,
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

    async getDeal(userId: string, dealId: string) {
        const deal = await this.dealRepository.findOne({
            where: {id: dealId},
            relations: ['listing', 'channel'],
        });

        if (!deal) {
            throw new DealServiceError(DealErrorCode.DEAL_NOT_FOUND);
        }

        if (
            deal.advertiserUserId !== userId &&
            deal.publisherOwnerUserId !== userId
        ) {
            throw new DealServiceError(DealErrorCode.UNAUTHORIZED_DEAL_ACCESS);
        }

        return this.buildDealItem(deal, userId);
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

        const items = deals.map((deal) => this.buildDealItem(deal, userId));

        return {
            items,
            page: group.page,
            limit: group.limit,
            total,
        };
    }

    private buildDealItem(deal: DealEntity, userId: string) {
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
                      format: listingSnapshot?.format ?? ListingFormat.POST,
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
            creativeSubmittedAt: deal.creativeSubmittedAt,
            adminReviewComment: deal.adminReviewComment,
            paymentDeadlineAt: deal.paymentDeadlineAt,
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

    private ensureTransitionAllowed(
        from: DealEscrowStatus,
        to: DealEscrowStatus,
    ) {
        try {
            assertTransitionAllowed(from, to);
        } catch (error) {
            if (error instanceof DealStateError) {
                throw new DealServiceError(DealErrorCode.INVALID_TRANSITION);
            }
            throw error;
        }
    }

    private buildActivityUpdate(now: Date): {
        lastActivityAt: Date;
        idleExpiresAt: Date;
    } {
        return {
            lastActivityAt: now,
            idleExpiresAt: this.addMinutes(
                now,
                DEALS_CONFIG.DEAL_IDLE_EXPIRE_MINUTES,
            ),
        };
    }

    private addMinutes(date: Date, minutes: number): Date {
        return new Date(date.getTime() + minutes * 60_000);
    }

    private addHours(date: Date, hours: number): Date {
        return new Date(date.getTime() + hours * 3_600_000);
    }
}
