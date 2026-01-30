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
import {PaymentsService} from '../payments/payments.service';
import {TransactionEntity} from '../payments/entities/transaction.entity';
import {TelegramBotService} from '../telegram-bot/telegram-bot.service';
import {ChannelAdminRecheckService} from '../channels/guards/channel-admin-recheck.service';
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
    DealEscrowStatus.APPROVED_SCHEDULED,
    DealEscrowStatus.POSTED_VERIFYING,
    DealEscrowStatus.CREATIVE_PENDING,
    DealEscrowStatus.CREATIVE_REVIEW,
];

const ACTIVE_PREDEAL_ESCROW_STATUSES = [
    DealEscrowStatus.SCHEDULING_PENDING,
    DealEscrowStatus.CREATIVE_AWAITING_SUBMIT,
    DealEscrowStatus.CREATIVE_AWAITING_CONFIRM,
    DealEscrowStatus.ADMIN_REVIEW,
    DealEscrowStatus.PAYMENT_WINDOW_PENDING,
    DealEscrowStatus.PAYMENT_AWAITING,
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
        private readonly paymentsService: PaymentsService,
        private readonly telegramBotService: TelegramBotService,
        private readonly channelAdminRecheckService: ChannelAdminRecheckService,
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

        const activePredealCount = await this.dealRepository.count({
            where: {
                listingId,
                advertiserUserId: userId,
                status: DealStatus.PENDING,
                escrowStatus: In(ACTIVE_PREDEAL_ESCROW_STATUSES),
            },
        });

        if (
            activePredealCount >=
            DEALS_CONFIG.MAX_ACTIVE_PREDEALS_PER_LISTING_PER_USER
        ) {
            throw new DealServiceError(
                DealErrorCode.ACTIVE_PREDEALS_LIMIT_REACHED,
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
        const predealExpiresAt = this.addMinutes(
            now,
            DEALS_CONFIG.PREDEAL_IDLE_EXPIRE_MINUTES,
        );
        const creativeMustBeSubmittedBy = this.addMinutes(
            now,
            DEALS_CONFIG.CREATIVE_SUBMIT_DEADLINE_MINUTES,
        );

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
                escrowStatus: DealEscrowStatus.SCHEDULING_PENDING,
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
                predealExpiresAt,
                creativeMustBeSubmittedBy,
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

        await this.dealRepository.update(deal.id, {
            scheduledAt: parsedScheduledAt,
            escrowStatus,
            status: mapEscrowToDealStatus(escrowStatus),
            ...this.buildActivityUpdate(now),
        });

        return {
            id: deal.id,
            status: mapEscrowToDealStatus(escrowStatus),
            escrowStatus,
            scheduledAt: parsedScheduledAt,
        };
    }

    async attachCreative(userId: string, dealId: string) {
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

    async confirmCreative(userId: string, dealId: string) {
        const deal = await this.dealRepository.findOne({where: {id: dealId}});

        if (!deal) {
            throw new DealServiceError(DealErrorCode.DEAL_NOT_FOUND);
        }

        if (deal.advertiserUserId !== userId) {
            throw new DealServiceError(DealErrorCode.UNAUTHORIZED_DEAL_ACCESS);
        }

        const escrowStatus = DealEscrowStatus.ADMIN_REVIEW;
        this.ensureTransitionAllowed(deal.escrowStatus, escrowStatus);

        const now = new Date();
        const adminMustRespondBy = this.addHours(
            now,
            DEALS_CONFIG.ADMIN_RESPONSE_DEADLINE_HOURS,
        );
        await this.dealRepository.update(deal.id, {
            escrowStatus,
            status: mapEscrowToDealStatus(escrowStatus),
            adminReviewNotifiedAt: now,
            adminMustRespondBy,
            ...this.buildActivityUpdate(now),
        });

        return {
            id: deal.id,
            status: mapEscrowToDealStatus(escrowStatus),
            escrowStatus,
        };
    }

    async approveByAdmin(dealId: string, adminUserId: string) {
        const deal = await this.dealRepository.findOne({
            where: {id: dealId},
            relations: {listing: true, channel: true},
        });

        if (!deal) {
            throw new DealServiceError(DealErrorCode.DEAL_NOT_FOUND);
        }

        if (deal.publisherOwnerUserId !== adminUserId) {
            throw new DealServiceError(DealErrorCode.UNAUTHORIZED_DEAL_ACCESS);
        }

        if (!deal.channelId) {
            throw new DealServiceError(DealErrorCode.DEAL_NOT_FOUND);
        }

        if (deal.status !== DealStatus.PENDING) {
            throw new DealServiceError(DealErrorCode.INVALID_TRANSITION);
        }

        const allowedStatuses = new Set<DealEscrowStatus>([
            DealEscrowStatus.ADMIN_REVIEW,
            DealEscrowStatus.CREATIVE_AWAITING_CONFIRM,
            DealEscrowStatus.PAYMENT_AWAITING,
        ]);
        if (!allowedStatuses.has(deal.escrowStatus)) {
            throw new DealServiceError(DealErrorCode.INVALID_TRANSITION);
        }

        const adminUser = await this.userRepository.findOne({
            where: {id: adminUserId},
        });
        const adminTelegramId = adminUser?.telegramId
            ? Number(adminUser.telegramId)
            : NaN;
        if (!Number.isFinite(adminTelegramId)) {
            throw new DealServiceError(DealErrorCode.UNAUTHORIZED_DEAL_ACCESS);
        }

        try {
            await this.channelAdminRecheckService.requireChannelRights({
                channelId: deal.channelId,
                userId: adminUserId,
                telegramId: adminTelegramId,
                required: {allowManager: true},
            });
        } catch (error) {
            throw new DealServiceError(DealErrorCode.UNAUTHORIZED_DEAL_ACCESS);
        }

        const amountNano =
            deal.listingSnapshot?.priceNano ?? deal.listing?.priceNano ?? null;
        if (!amountNano) {
            throw new DealServiceError(DealErrorCode.LISTING_NOT_FOUND);
        }

        const now = new Date();
        const expiresAt = this.addMinutes(
            now,
            DEALS_CONFIG.PAYMENT_WINDOW_MINUTES,
        );

        let paymentPayload:
            | {
                  transactionId: string;
                  status: string;
                  currency: string;
                  amountNano: string;
                  payToAddress: string;
              }
            | undefined;
        let escrowStatus = DealEscrowStatus.PAYMENT_AWAITING;
        let escrowExpiresAt: Date | null = null;
        let shouldNotify = false;
        let escrowAmountNano = amountNano;

        await this.dataSource.transaction(async (manager) => {
            const dealRepository = manager.getRepository(DealEntity);
            const transactionRepository = manager.getRepository(TransactionEntity);

            const lockedDeal = await dealRepository.findOne({
                where: {id: dealId},
                lock: {mode: 'pessimistic_write'},
            });

            if (!lockedDeal) {
                throw new DealServiceError(DealErrorCode.DEAL_NOT_FOUND);
            }

            if (lockedDeal.escrowTransactionId) {
                const existingTx = await transactionRepository.findOne({
                    where: {id: lockedDeal.escrowTransactionId},
                });

                if (!existingTx?.depositAddress) {
                    throw new DealServiceError(DealErrorCode.DEAL_NOT_FOUND);
                }

                escrowStatus = lockedDeal.escrowStatus;
                escrowExpiresAt = lockedDeal.escrowExpiresAt;
                escrowAmountNano = lockedDeal.escrowAmountNano ?? existingTx.amountNano;

                paymentPayload = {
                    transactionId: existingTx.id,
                    status: existingTx.status,
                    currency: existingTx.currency,
                    amountNano: escrowAmountNano,
                    payToAddress: existingTx.depositAddress,
                };
                return;
            }

            this.ensureTransitionAllowed(lockedDeal.escrowStatus, escrowStatus);

            const createdTransaction = await this.paymentsService.createTransaction(
                {
                    userId: lockedDeal.advertiserUserId,
                    amountNano,
                    currency: 'TON',
                    dealId: lockedDeal.id,
                    channelId: lockedDeal.channelId,
                    counterpartyUserId: lockedDeal.publisherOwnerUserId ?? null,
                    description: `Escrow hold for deal ${lockedDeal.id}`,
                    metadata: {purpose: 'deal_escrow'},
                },
                manager,
            );

            await dealRepository.update(lockedDeal.id, {
                escrowTransactionId: createdTransaction.id,
                escrowStatus,
                status: mapEscrowToDealStatus(escrowStatus),
                escrowAmountNano: amountNano,
                escrowCurrency: 'TON',
                escrowExpiresAt: expiresAt,
                paymentMustBePaidBy: expiresAt,
                lastActivityAt: now,
                predealExpiresAt: this.addMinutes(
                    now,
                    DEALS_CONFIG.PREDEAL_IDLE_EXPIRE_MINUTES,
                ),
                stalledAt: null,
                cancelReason: null,
            });

            escrowExpiresAt = expiresAt;
            paymentPayload = {
                transactionId: createdTransaction.id,
                status: createdTransaction.status,
                currency: createdTransaction.currency,
                amountNano: createdTransaction.amountNano,
                payToAddress: createdTransaction.payToAddress,
            };
            shouldNotify = true;
        });

        if (!paymentPayload) {
            throw new DealServiceError(DealErrorCode.DEAL_NOT_FOUND);
        }

        if (shouldNotify) {
            await this.notifyAdvertiserPaymentRequest(
                deal.advertiserUserId,
                deal.id,
                paymentPayload.amountNano,
                paymentPayload.payToAddress,
                escrowExpiresAt,
            );
        }

        return {
            dealId: deal.id,
            escrowStatus,
            payment: {
                transactionId: paymentPayload.transactionId,
                amountNano: paymentPayload.amountNano,
                currency: paymentPayload.currency,
                payToAddress: paymentPayload.payToAddress,
                expiresAt: escrowExpiresAt,
            },
        };
    }

    async setPaymentWindow(
        userId: string,
        dealId: string,
        expiresAt: Date,
    ) {
        const deal = await this.dealRepository.findOne({where: {id: dealId}});

        if (!deal) {
            throw new DealServiceError(DealErrorCode.DEAL_NOT_FOUND);
        }

        if (deal.publisherOwnerUserId !== userId) {
            throw new DealServiceError(DealErrorCode.UNAUTHORIZED_DEAL_ACCESS);
        }

        const escrowStatus = DealEscrowStatus.PAYMENT_AWAITING;
        this.ensureTransitionAllowed(deal.escrowStatus, escrowStatus);

        const now = new Date();
        await this.dealRepository.update(deal.id, {
            escrowStatus,
            status: mapEscrowToDealStatus(escrowStatus),
            escrowExpiresAt: expiresAt,
            paymentMustBePaidBy: expiresAt,
            ...this.buildActivityUpdate(now),
        });

        return {
            id: deal.id,
            status: mapEscrowToDealStatus(escrowStatus),
            escrowStatus,
            escrowExpiresAt: expiresAt,
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
        predealExpiresAt: Date;
    } {
        return {
            lastActivityAt: now,
            predealExpiresAt: this.addMinutes(
                now,
                DEALS_CONFIG.PREDEAL_IDLE_EXPIRE_MINUTES,
            ),
        };
    }

    private addMinutes(date: Date, minutes: number): Date {
        return new Date(date.getTime() + minutes * 60_000);
    }

    private addHours(date: Date, hours: number): Date {
        return new Date(date.getTime() + hours * 3_600_000);
    }

    private async notifyAdvertiserPaymentRequest(
        advertiserUserId: string,
        dealId: string,
        amountNano: string,
        address: string,
        expiresAt?: Date | null,
    ): Promise<void> {
        const advertiser = await this.userRepository.findOne({
            where: {id: advertiserUserId},
        });

        if (!advertiser?.telegramId) {
            this.logger.warn(
                `Skipping payment notification: missing telegramId for advertiser ${advertiserUserId}`,
            );
            return;
        }

        const amountTon = this.formatTonAmount(amountNano);

        try {
            await this.telegramBotService.sendPaymentRequestToAdvertiser(
                advertiser.telegramId,
                dealId,
                amountTon,
                address,
                expiresAt,
            );
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            this.logger.warn(
                `Failed to send payment request to advertiser ${advertiserUserId}: ${errorMessage}`,
            );
        }
    }

    private formatTonAmount(amountNano: string): string {
        try {
            const value = BigInt(amountNano);
            const whole = value / 1_000_000_000n;
            const fraction = value % 1_000_000_000n;
            if (fraction === 0n) {
                return whole.toString();
            }
            const fractionText = fraction
                .toString()
                .padStart(9, '0')
                .replace(/0+$/, '');
            return `${whole.toString()}.${fractionText}`;
        } catch (error) {
            return amountNano;
        }
    }
}
