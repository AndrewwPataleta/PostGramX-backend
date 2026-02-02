import {Injectable, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Brackets, DataSource, In, Repository} from 'typeorm';
import {DealEntity} from './entities/deal.entity';
import {DealCreativeEntity} from './entities/deal-creative.entity';
import {DealEscrowEntity} from './entities/deal-escrow.entity';
import {DealPublicationEntity} from './entities/deal-publication.entity';
import {ListingEntity} from '../listings/entities/listing.entity';
import {DealStatus} from '../../common/constants/deals/deal-status.constants';
import {DealStage} from '../../common/constants/deals/deal-stage.constants';
import {DealErrorCode, DealServiceError} from './errors/deal-service.error';
import {ChannelEntity} from '../channels/entities/channel.entity';
import {DealsNotificationsService} from './deals-notifications.service';
import {ChannelMembershipEntity} from '../channels/entities/channel-membership.entity';
import {ChannelRole} from '../channels/types/channel-role.enum';
import {DealListingSnapshot} from './types/deal-listing-snapshot.type';
import {mapStageToDealStatus} from './state/deal-status.mapper';
import {assertTransitionAllowed, DealStateError} from './state/deal-state.machine';
import {DEALS_CONFIG} from '../../config/deals.config';
import {User} from '../auth/entities/user.entity';
import {CreativeStatus} from '../../common/constants/deals/creative-status.constants';
import {PaymentsService} from '../payments/payments.service';
import {ChannelAdminRecheckService} from '../channels/guards/channel-admin-recheck.service';
import {EscrowStatus} from '../../common/constants/deals/deal-escrow-status.constants';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
type ChangeRequestType = 'creative' | 'schedule';

@Injectable()
export class DealsService {
    private readonly logger = new Logger(DealsService.name);

    constructor(
        private readonly dataSource: DataSource,
        @InjectRepository(DealEntity)
        private readonly dealRepository: Repository<DealEntity>,
        @InjectRepository(DealCreativeEntity)
        private readonly creativeRepository: Repository<DealCreativeEntity>,
        @InjectRepository(DealEscrowEntity)
        private readonly escrowRepository: Repository<DealEscrowEntity>,
        @InjectRepository(DealPublicationEntity)
        private readonly publicationRepository: Repository<DealPublicationEntity>,
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
        private readonly channelAdminRecheckService: ChannelAdminRecheckService,
    ) {
    }

    async createDeal(
        userId: string,
        listingId: string,
        _brief?: string,
        _scheduledAt?: string,
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

        const activePendingCount = await this.dealRepository.count({
            where: {
                listingId,
                advertiserUserId: userId,
                status: DealStatus.PENDING,
                stage: In([
                    DealStage.CREATIVE_AWAITING_SUBMIT,
                    DealStage.CREATIVE_AWAITING_FOR_CHANGES,
                    DealStage.PAYMENT_AWAITING,
                    DealStage.PAYMENT_PARTIALLY_PAID,
                    DealStage.SCHEDULE_AWAITING_FOR_CHANGES,
                ]),
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

        const now = new Date();
        const listingSnapshot = this.buildListingSnapshot(listing, now);
        const stage = DealStage.CREATIVE_AWAITING_SUBMIT;

        const deal = await this.dataSource.transaction(async (manager) => {
            const repo = manager.getRepository(DealEntity);
            const escrowRepo = manager.getRepository(DealEscrowEntity);
            const created = repo.create({
                listingId: listing.id,
                channelId: listing.channelId,
                advertiserUserId: userId,
                createdByUserId: userId,
                status: mapStageToDealStatus(stage),
                stage,
                listingSnapshot,
                scheduledAt: null,
                lastActivityAt: now,
                idleExpiresAt: this.computeIdleExpiry(stage, now),
            });

            const saved = await repo.save(created);



            return saved;
        });


        const advertiser = await this.userRepository.findOne({
            where: {id: deal.advertiserUserId},
        });

        if (advertiser?.telegramId) {
            try {
                await this.dealsNotificationsService.notifyCreativeRequired(
                    deal,
                    advertiser.telegramId,
                );
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : String(error);
                this.logger.warn(
                    `Creative notification failed for dealId=${deal.id}: ${errorMessage}`,
                );
            }
        }

        return {
            id: deal.id,
            status: deal.status,
            stage: deal.stage,
            listingId: deal.listingId,
            channelId: deal.channelId,
        };
    }

    async scheduleDeal(userId: string, dealId: string, scheduledAt: string) {
        const deal = await this.dealRepository.findOne({where: {id: dealId}});

        if (!deal) {
            throw new DealServiceError(DealErrorCode.DEAL_NOT_FOUND);
        }

        if (deal.advertiserUserId !== userId) {
            throw new DealServiceError(DealErrorCode.UNAUTHORIZED);
        }

        const parsedScheduledAt = new Date(scheduledAt);
        if (parsedScheduledAt.getTime() <= Date.now()) {
            throw new DealServiceError(DealErrorCode.INVALID_SCHEDULE_TIME);
        }

        this.ensureTransitionAllowed(
            deal.stage,
            DealStage.SCHEDULING_AWAITING_CONFIRM,
        );

        const now = new Date();
        const stage = DealStage.SCHEDULING_AWAITING_CONFIRM;

        await this.dealRepository.update(deal.id, {
            scheduledAt: parsedScheduledAt,
            stage,
            status: mapStageToDealStatus(stage),
            idleExpiresAt: this.computeIdleExpiry(stage, now),
            ...this.buildActivityUpdate(now),
        });

        const [updatedDeal, latestCreative] = await Promise.all([
            this.dealRepository.findOne({where: {id: deal.id}}),
            this.creativeRepository.findOne({
                where: {dealId: deal.id},
                order: {version: 'DESC'},
            }),
        ]);

        if (updatedDeal && latestCreative) {
            try {
                await this.dealsNotificationsService.notifyScheduleSubmitted(
                    updatedDeal,
                    latestCreative,
                );
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : String(error);
                this.logger.warn(
                    `Schedule notification failed for dealId=${deal.id}: ${errorMessage}`,
                );
            }
        } else if (!latestCreative) {
            this.logger.warn(
                `Schedule notification skipped: missing creative for dealId=${deal.id}`,
            );
        }

        return {
            id: deal.id,
            status: mapStageToDealStatus(stage),
            stage,
        };
    }

    async handleCreativeMessage(payload: {
        traceId: string;
        telegramUserId: string;
        type: string;
        text: string | null;
        caption: string | null;
        mediaFileId: string | null;
        rawPayload: Record<string, unknown>;
    }): Promise<{
        success: boolean;
        dealId?: string;
        messageKey: string;
        messageArgs?: Record<string, any>;
    }> {
        const advertiser = await this.userRepository.findOne({
            where: {telegramId: payload.telegramUserId},
        });

        if (!advertiser) {
            return {
                success: false,
                messageKey: 'telegram.deal.creative.link_account_required',
            };
        }

        const deal = await this.dealRepository.findOne({
            where: {
                advertiserUserId: advertiser.id,
                stage: In([
                    DealStage.CREATIVE_AWAITING_SUBMIT,
                    DealStage.CREATIVE_AWAITING_FOR_CHANGES,
                ]),
            },
            order: {lastActivityAt: 'DESC'},
        });

        if (!deal) {
            return {
                success: false,
                messageKey: 'telegram.deal.creative.no_active_deal',
            };
        }

        const latestCreative = await this.creativeRepository.findOne({
            where: {dealId: deal.id},
            order: {version: 'DESC'},
        });

        const nextVersion = latestCreative ? latestCreative.version : 1;
        const creative = latestCreative
            ? latestCreative
            : this.creativeRepository.create({
                dealId: deal.id,
                version: nextVersion,
                status: CreativeStatus.DRAFT,
            });

        creative.status = CreativeStatus.RECEIVED_IN_BOT;
        creative.botChatId = String(payload.rawPayload.chatId ?? '');
        creative.botMessageId = String(payload.rawPayload.messageId ?? '');
        creative.payload = {
            type: payload.type,
            text: payload.text,
            caption: payload.caption,
            mediaFileId: payload.mediaFileId,
            ...payload.rawPayload,
        };

        await this.dataSource.transaction(async (manager) => {
            const creativeRepo = manager.getRepository(DealCreativeEntity);
            const dealRepo = manager.getRepository(DealEntity);
            await creativeRepo.save(creative);
            const stage = DealStage.CREATIVE_AWAITING_CONFIRM;
            await dealRepo.update(deal.id, {
                stage,
                status: mapStageToDealStatus(stage),
                idleExpiresAt: this.computeIdleExpiry(stage, new Date()),
                ...this.buildActivityUpdate(new Date()),
            });
        });


        const now = new Date();

        await this.dealsNotificationsService.notifyCreativeSubmitted(
            deal,
            {
                ...creative,
                status: CreativeStatus.RECEIVED_IN_BOT,
                submittedAt: now,
                submittedByUserId: deal.advertiserUserId,
            } as DealCreativeEntity,
        );

        return {
            success: true,
            dealId: deal.id,
            messageKey: 'telegram.deal.creative.saved',
            messageArgs: {dealId: deal.id.slice(0, 8)},
        };
    }

    async submitCreative(userId: string, dealId: string) {
        const deal = await this.dealRepository.findOne({where: {id: dealId}});

        if (!deal) {
            throw new DealServiceError(DealErrorCode.DEAL_NOT_FOUND);
        }

        if (deal.advertiserUserId !== userId) {
            throw new DealServiceError(DealErrorCode.UNAUTHORIZED);
        }

        const creative = await this.creativeRepository.findOne({
            where: {dealId},
            order: {version: 'DESC'},
        });

        if (!creative || creative.status !== CreativeStatus.RECEIVED_IN_BOT) {
            throw new DealServiceError(DealErrorCode.CREATIVE_NOT_SUBMITTED);
        }


        const now = new Date();
        const stage = DealStage.CREATIVE_AWAITING_CONFIRM;

        await this.dataSource.transaction(async (manager) => {
            const creativeRepo = manager.getRepository(DealCreativeEntity);
            const dealRepo = manager.getRepository(DealEntity);

            await creativeRepo.update(creative.id, {
                status: CreativeStatus.RECEIVED_IN_BOT,
                submittedAt: now,
                submittedByUserId: userId,
            });

            await dealRepo.update(deal.id, {
                stage,
                status: mapStageToDealStatus(stage),
                idleExpiresAt: this.computeIdleExpiry(stage, now),
                ...this.buildActivityUpdate(now),
            });
        });

        const updatedDeal = await this.dealRepository.findOne({
            where: {id: deal.id},
        });

        if (updatedDeal) {
            await this.dealsNotificationsService.notifyCreativeSubmitted(
                updatedDeal,
                {
                    ...creative,
                    status: CreativeStatus.RECEIVED_IN_BOT,
                    submittedAt: now,
                    submittedByUserId: userId,
                } as DealCreativeEntity,
            );
        }

        return {id: deal.id, stage};
    }

    async getCreativeStatus(userId: string, dealId: string) {
        const deal = await this.dealRepository.findOne({where: {id: dealId}});

        if (!deal) {
            throw new DealServiceError(DealErrorCode.DEAL_NOT_FOUND);
        }

        if (deal.advertiserUserId !== userId) {
            throw new DealServiceError(DealErrorCode.UNAUTHORIZED);
        }

        const creative = await this.creativeRepository.findOne({
            where: {dealId},
            order: {version: 'DESC'},
        });

        return {
            dealId: deal.id,
            stage: deal.stage,
            creative: creative
                ? {
                    id: creative.id,
                    version: creative.version,
                    status: creative.status,
                    submittedAt: creative.submittedAt,
                    reviewedAt: creative.reviewedAt,
                }
                : null,
        };
    }

    async approveCreativeByAdmin(userId: string, dealId: string) {
        const deal = await this.dealRepository.findOne({
            where: {id: dealId},
        });

        if (!deal) {
            throw new DealServiceError(DealErrorCode.DEAL_NOT_FOUND);
        }

        await this.ensurePublisherAdmin(userId, deal);

        this.ensureTransitionAllowed(deal.stage, DealStage.SCHEDULING_AWAITING_SUBMIT);

        const creative = await this.creativeRepository.findOne({
            where: {dealId, status: CreativeStatus.RECEIVED_IN_BOT},
            order: {version: 'DESC'},
        });

        if (!creative) {
            throw new DealServiceError(DealErrorCode.CREATIVE_NOT_SUBMITTED);
        }

        const now = new Date();

        await this.dataSource.transaction(async (manager) => {
            const creativeRepo = manager.getRepository(DealCreativeEntity);
            const escrowRepo = manager.getRepository(DealEscrowEntity);
            const dealRepo = manager.getRepository(DealEntity);

            await creativeRepo.update(creative.id, {
                status: CreativeStatus.APPROVED,
                reviewedAt: now,
            });

            const escrow = await escrowRepo.findOne({
                where: {dealId: deal.id},
                lock: {mode: 'pessimistic_write'},
            });

            const stage = DealStage.SCHEDULING_AWAITING_SUBMIT;
            await dealRepo.update(deal.id, {
                stage,
                status: mapStageToDealStatus(stage),
                idleExpiresAt: this.computeIdleExpiry(stage, now),
                ...this.buildActivityUpdate(now),
            });
        });

        const updatedDeal = await this.dealRepository.findOne({
            where: {id: deal.id},
        });
        const updatedEscrow = await this.escrowRepository.findOne({
            where: {dealId: deal.id},
        });

        if (updatedDeal && updatedEscrow) {
            await this.dealsNotificationsService.notifyAdvertiserPaymentRequired(
                updatedDeal,
                updatedEscrow,
            );
        }

        return {id: deal.id, stage: DealStage.PAYMENT_AWAITING};
    }

    async approveScheduleByAdmin(userId: string, dealId: string) {
        const deal = await this.dealRepository.findOne({
            where: {id: dealId},
        });

        if (!deal) {
            throw new DealServiceError(DealErrorCode.DEAL_NOT_FOUND);
        }

        await this.ensurePublisherAdmin(userId, deal);

        this.ensureTransitionAllowed(deal.stage, DealStage.PAYMENT_AWAITING);

        const now = new Date();

        await this.dataSource.transaction(async (manager) => {
            const escrowRepo = manager.getRepository(DealEscrowEntity);
            const dealRepo = manager.getRepository(DealEntity);

            const escrow = escrowRepo.create({
                dealId: deal.id,
                status: EscrowStatus.NOT_CREATED,
                amountNano: deal.listingSnapshot.priceNano,
                paidNano: '0',
                currency: deal.listingSnapshot.currency,
            });
            await escrowRepo.save(escrow);

            const amountNano =
                (deal.listingSnapshot as DealListingSnapshot).priceNano ?? '0';
            const {wallet} = await this.paymentsService.createEscrowHold({
                manager,
                deal,
                escrow,
                amountNano,
            });

            const paymentDeadlineAt = this.addMinutes(
                now,
                DEALS_CONFIG.PAYMENT_DEADLINE_MINUTES,
            );

            await escrowRepo.update(escrow.id, {
                status: EscrowStatus.AWAITING_PAYMENT,
                amountNano,
                walletId: wallet?.id ?? null,
                paymentAddress: wallet?.address ?? null,
                paymentDeadlineAt,
            });

            const stage = DealStage.PAYMENT_AWAITING;
            await dealRepo.update(deal.id, {
                stage,
                status: mapStageToDealStatus(stage),
                idleExpiresAt: this.computeIdleExpiry(stage, now),
                ...this.buildActivityUpdate(now),
            });
        });

        const updatedDeal = await this.dealRepository.findOne({
            where: {id: deal.id},
        });
        const updatedEscrow = await this.escrowRepository.findOne({
            where: {dealId: deal.id},
        });

        if (updatedDeal && updatedEscrow) {
            await this.dealsNotificationsService.notifyAdvertiserPaymentRequired(
                updatedDeal,
                updatedEscrow,
            );
        }

        return {id: deal.id, stage: DealStage.PAYMENT_AWAITING};
    }

    async requestChangesByAdmin(
        userId: string,
        dealId: string,
        comment?: string,
        requestType?: ChangeRequestType,
    ) {

const deal = await this.dealRepository.findOne({where: {id: dealId}});

        if (!deal) {
            throw new DealServiceError(DealErrorCode.DEAL_NOT_FOUND);
        }

        await this.ensurePublisherAdmin(userId, deal);

        const resolvedType =
            requestType ?? this.resolveChangeRequestType(deal);
        const targetStage =
            resolvedType === 'creative'
                ? DealStage.CREATIVE_AWAITING_FOR_CHANGES
                : DealStage.SCHEDULE_AWAITING_FOR_CHANGES;

        this.ensureTransitionAllowed(deal.stage, targetStage);

        if (resolvedType === 'creative') {
            return this.applyCreativeChangesRequest(deal, comment);
        }

        return this.applyScheduleChangesRequest(deal, comment);
    }

    async rejectByAdmin(userId: string, dealId: string, reason?: string) {
        const deal = await this.dealRepository.findOne({where: {id: dealId}});

        if (!deal) {
            throw new DealServiceError(DealErrorCode.DEAL_NOT_FOUND);
        }

        await this.ensurePublisherAdmin(userId, deal);

        this.ensureTransitionAllowed(
            deal.stage,
            DealStage.FINALIZED,
        );

        const creative = await this.creativeRepository.findOne({
            where: {dealId, status: CreativeStatus.RECEIVED_IN_BOT},
            order: {version: 'DESC'},
        });

        if (!creative) {
            throw new DealServiceError(DealErrorCode.CREATIVE_NOT_SUBMITTED);
        }

        const now = new Date();

        await this.dataSource.transaction(async (manager) => {
            const creativeRepo = manager.getRepository(DealCreativeEntity);
            const dealRepo = manager.getRepository(DealEntity);

            await creativeRepo.update(creative.id, {
                status: CreativeStatus.REJECTED,
                adminComment: reason ?? null,
                reviewedAt: now,
            });

            const nextVersion = creative.version + 1;
            const newCreative = creativeRepo.create({
                dealId: deal.id,
                version: nextVersion,
                status: CreativeStatus.DRAFT,
            });
            await creativeRepo.save(newCreative);

            const stage = DealStage.CREATIVE_AWAITING_SUBMIT;
            await dealRepo.update(deal.id, {
                stage,
                status: mapStageToDealStatus(stage),
                idleExpiresAt: this.computeIdleExpiry(stage, now),
                ...this.buildActivityUpdate(now),
            });
        });

        const updatedDeal = await this.dealRepository.findOne({
            where: {id: deal.id},
        });
        if (updatedDeal) {
            await this.dealsNotificationsService.notifyAdvertiser(
                updatedDeal,
                'telegram.deal.creative.rejected_resubmit',
            );
        }

        return {id: deal.id, stage: DealStage.CREATIVE_AWAITING_SUBMIT};
    }

    private async ensureChangeRequestAllowed(
        userId: string,
        dealId: string,
        requestType: ChangeRequestType,
    ): Promise<void> {
        const deal = await this.dealRepository.findOne({where: {id: dealId}});

        if (!deal) {
            throw new DealServiceError(DealErrorCode.DEAL_NOT_FOUND);
        }

        await this.ensurePublisherAdmin(userId, deal);

        const targetStage =
            requestType === 'creative'
                ? DealStage.CREATIVE_AWAITING_FOR_CHANGES
                : DealStage.SCHEDULE_AWAITING_FOR_CHANGES;

        this.ensureTransitionAllowed(deal.stage, targetStage);

        if (requestType === 'creative') {
            const creative = await this.creativeRepository.findOne({
                where: {dealId, status: CreativeStatus.RECEIVED_IN_BOT},
                order: {version: 'DESC'},
            });

            if (!creative) {
                throw new DealServiceError(DealErrorCode.CREATIVE_NOT_SUBMITTED);
            }
        }
    }

    private resolveChangeRequestType(deal: DealEntity): ChangeRequestType {
        if (deal.stage === DealStage.CREATIVE_AWAITING_CONFIRM) {
            return 'creative';
        }

        if (deal.stage === DealStage.SCHEDULING_AWAITING_CONFIRM) {
            return 'schedule';
        }

        throw new DealServiceError(DealErrorCode.INVALID_STATUS);
    }

    private async applyCreativeChangesRequest(
        deal: DealEntity,
        comment?: string,
    ): Promise<{ id: string; stage: DealStage }> {
        const creative = await this.creativeRepository.findOne({
            where: {dealId: deal.id, status: CreativeStatus.RECEIVED_IN_BOT},
            order: {version: 'DESC'},
        });

        if (!creative) {
            throw new DealServiceError(DealErrorCode.CREATIVE_NOT_SUBMITTED);
        }

        const now = new Date();
        const trimmedComment = comment?.trim() ?? '';

        await this.dataSource.transaction(async (manager) => {
            const creativeRepo = manager.getRepository(DealCreativeEntity);
            const dealRepo = manager.getRepository(DealEntity);

            await creativeRepo.update(creative.id, {
                status: CreativeStatus.REJECTED,
                adminComment: trimmedComment || null,
                reviewedAt: now,
            });

            const nextVersion = creative.version + 1;
            const newCreative = creativeRepo.create({
                dealId: deal.id,
                version: nextVersion,
                status: CreativeStatus.DRAFT,
            });
            await creativeRepo.save(newCreative);

            const stage = DealStage.CREATIVE_AWAITING_FOR_CHANGES;
            await dealRepo.update(deal.id, {
                stage,
                status: mapStageToDealStatus(stage),
                idleExpiresAt: this.computeIdleExpiry(stage, now),
                ...this.buildActivityUpdate(now),
            });
        });

        const commentText = trimmedComment || '-';
        await this.dealsNotificationsService.notifyAdvertiser(
            deal,
            'telegram.deal.creative.changes_requested_advertiser',
            {
                dealId: deal.id.slice(0, 8),
                comment: commentText,
            },
        );

        return {id: deal.id, stage: DealStage.CREATIVE_AWAITING_FOR_CHANGES};
    }

    private async applyScheduleChangesRequest(
        deal: DealEntity,
        comment?: string,
    ): Promise<{ id: string; stage: DealStage }> {
        const now = new Date();
        const trimmedComment = comment?.trim() ?? '';
        const stage = DealStage.SCHEDULE_AWAITING_FOR_CHANGES;

        await this.dealRepository.update(deal.id, {
            stage,
            status: mapStageToDealStatus(stage),
            idleExpiresAt: this.computeIdleExpiry(stage, now),
            ...this.buildActivityUpdate(now),
        });

        const commentText = trimmedComment || '-';
        await this.dealsNotificationsService.notifyAdvertiser(
            deal,
            'telegram.deal.schedule.changes_requested_advertiser',
            {
                dealId: deal.id.slice(0, 8),
                comment: commentText,
            },
        );

        return {id: deal.id, stage};
    }

    async handleCreativeApprovalFromTelegram(payload: {
        telegramUserId: string;
        dealId: string;
    }): Promise<{
        handled: boolean;
        messageKey?: string;
        messageArgs?: Record<string, any>;
    }> {
        const user = await this.userRepository.findOne({
            where: {telegramId: payload.telegramUserId},
        });

        if (!user) {
            return {handled: false};
        }

        await this.approveCreativeByAdmin(user.id, payload.dealId);

        return {
            handled: true,
            messageKey: 'telegram.deal.creative.approved_payment_sent',
            messageArgs: undefined,
        };
    }

    async handleScheduleApprovalFromTelegram(payload: {
        telegramUserId: string;
        dealId: string;
    }): Promise<{
        handled: boolean;
        messageKey?: string;
        messageArgs?: Record<string, any>;
    }> {
        const user = await this.userRepository.findOne({
            where: {telegramId: payload.telegramUserId},
        });

        if (!user) {
            return {handled: false};
        }

        await this.approveScheduleByAdmin(user.id, payload.dealId);

        return {
            handled: true,
            messageKey: 'telegram.deal.schedule.approved',
            messageArgs: undefined,
        };
    }

    async handleCreativeRequestChangesFromTelegram(payload: {
        telegramUserId: string;
        dealId: string;
    }): Promise<{
        handled: boolean;
        messageKey?: string;
        messageArgs?: Record<string, any>;
    }> {
        const user = await this.userRepository.findOne({
            where: {telegramId: payload.telegramUserId},
        });

        if (!user) {
            return {handled: false};
        }

        await this.ensureChangeRequestAllowed(
            user.id,
            payload.dealId,
            'creative',
        );

        return {
            handled: true,
            messageKey: 'telegram.deal.creative.request_changes_prompt',
            messageArgs: {dealId: payload.dealId},
        };
    }

    async handleScheduleRequestChangesFromTelegram(payload: {
        telegramUserId: string;
        dealId: string;
    }): Promise<{
        handled: boolean;
        messageKey?: string;
        messageArgs?: Record<string, any>;
    }> {
        const user = await this.userRepository.findOne({
            where: {telegramId: payload.telegramUserId},
        });

        if (!user) {
            return {handled: false};
        }

        await this.ensureChangeRequestAllowed(
            user.id,
            payload.dealId,
            'schedule',
        );

        return {
            handled: true,
            messageKey: 'telegram.deal.schedule.request_changes_prompt',
            messageArgs: {dealId: payload.dealId},
        };
    }

    async handleAdminRequestChangesReply(payload: {
        telegramUserId: string;
        dealId: string;
        comment?: string;
        requestType: ChangeRequestType;
    }): Promise<{
        handled: boolean;
        messageKey?: string;
        messageArgs?: Record<string, any>;
    }> {
        const user = await this.userRepository.findOne({
            where: {telegramId: payload.telegramUserId},
        });

        if (!user) {
            return {handled: false};
        }

        try {
            await this.requestChangesByAdmin(
                user.id,
                payload.dealId,
                payload.comment,
                payload.requestType,
            );

            return {
                handled: true,
                messageKey:
                    payload.requestType === 'creative'
                        ? 'telegram.deal.creative.changes_requested'
                        : 'telegram.deal.schedule.changes_requested',
                messageArgs: undefined,
            };
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            this.logger.warn('Failed to apply change request reply', {
                dealId: payload.dealId,
                requestType: payload.requestType,
                errorMessage,
            });

            return {
                handled: true,
                messageKey: 'telegram.deal.request_changes.failed',
                messageArgs: undefined,
            };
        }
    }

    async handleCreativeRejectFromTelegram(payload: {
        telegramUserId: string;
        dealId: string;
    }): Promise<{
        handled: boolean;
        messageKey?: string;
        messageArgs?: Record<string, any>;
    }> {
        const user = await this.userRepository.findOne({
            where: {telegramId: payload.telegramUserId},
        });

        if (!user) {
            return {handled: false};
        }

        await this.rejectByAdmin(user.id, payload.dealId, 'ADMIN_REJECTED');

        return {
            handled: true,
            messageKey: 'telegram.deal.creative.rejected_notified',
            messageArgs: undefined,
        };
    }

    async handleScheduleRejectFromTelegram(payload: {
        telegramUserId: string;
        dealId: string;
    }): Promise<{
        handled: boolean;
        messageKey?: string;
        messageArgs?: Record<string, any>;
    }> {
        const user = await this.userRepository.findOne({
            where: {telegramId: payload.telegramUserId},
        });

        if (!user) {
            return {handled: false};
        }

        await this.cancelDeal(user.id, payload.dealId, 'ADMIN_REJECTED');

        const updatedDeal = await this.dealRepository.findOne({
            where: {id: payload.dealId},
        });

        if (updatedDeal) {
            await this.dealsNotificationsService.notifyAdvertiser(
                updatedDeal,
                'telegram.deal.schedule.canceled_advertiser',
                {dealId: updatedDeal.id.slice(0, 8)},
            );
        }

        return {
            handled: true,
            messageKey: 'telegram.deal.schedule.canceled_notified',
            messageArgs: undefined,
        };
    }

    async cancelDeal(
        userId: string,
        dealId: string,
        reason?: string,
    ): Promise<{ id: string; stage: DealStage }> {
        const deal = await this.dealRepository.findOne({where: {id: dealId}});

        if (!deal) {
            throw new DealServiceError(DealErrorCode.DEAL_NOT_FOUND);
        }

        const canCancelAsAdvertiser = deal.advertiserUserId === userId;
        const canCancelAsPublisher =
            (await this.membershipRepository.findOne({
                where: {
                    channelId: deal.channelId,
                    userId,
                    isActive: true,
                },
            })) !== null;

        if (!canCancelAsAdvertiser && !canCancelAsPublisher) {
            throw new DealServiceError(DealErrorCode.UNAUTHORIZED);
        }

        const now = new Date();
        const stage = DealStage.FINALIZED;

        let shouldRefund = false;
        await this.dataSource.transaction(async (manager) => {
            const dealRepo = manager.getRepository(DealEntity);
            const escrowRepo = manager.getRepository(DealEscrowEntity);

            await dealRepo.update(deal.id, {
                status: DealStatus.CANCELED,
                stage,
                cancelReason: reason ?? 'CANCELED',
                ...this.buildActivityUpdate(now),
            });

            const escrow = await escrowRepo.findOne({where: {dealId: deal.id}});
            if (
                escrow &&
                [
                    EscrowStatus.PAID_CONFIRMED,
                    EscrowStatus.PARTIALLY_PAID,
                ].includes(escrow.status)
            ) {
                shouldRefund = true;
            }
        });

        if (shouldRefund) {
            await this.paymentsService.refundEscrow(deal.id, reason ?? 'CANCELED');
        }

        return {id: deal.id, stage};
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
        });

        const active = await this.fetchDealsGroup(userId, role, {
            page: options.activePage ?? DEFAULT_PAGE,
            limit: options.activeLimit ?? DEFAULT_LIMIT,
            statuses: [DealStatus.ACTIVE],
        });

        const completed = await this.fetchDealsGroup(userId, role, {
            page: options.completedPage ?? DEFAULT_PAGE,
            limit: options.completedLimit ?? DEFAULT_LIMIT,
            statuses: [DealStatus.COMPLETED, DealStatus.CANCELED],
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

        const isAdvertiser = deal.advertiserUserId === userId;
        const isPublisher =
            (await this.membershipRepository.findOne({
                where: {channelId: deal.channelId, userId},
            })) !== null;

        if (!isAdvertiser && !isPublisher) {
            throw new DealServiceError(DealErrorCode.UNAUTHORIZED);
        }

        const [escrow, publication, creative] = await Promise.all([
            this.escrowRepository.findOne({where: {dealId: deal.id}}),
            this.publicationRepository.findOne({where: {dealId: deal.id}}),
            this.creativeRepository.findOne({
                where: {dealId: deal.id},
                order: {version: 'DESC'},
            }),
        ]);

        return this.buildDealItem(deal, creative, escrow, publication);
    }

    private async fetchDealsGroup(
        userId: string,
        role: 'all' | 'advertiser' | 'publisher',
        group: {
            page: number;
            limit: number;
            statuses: DealStatus[];
        },
    ) {
        const qb = this.dealRepository
            .createQueryBuilder('deal')
            .leftJoinAndSelect('deal.listing', 'listing')
            .leftJoinAndSelect('deal.channel', 'channel')
            .where('deal.status IN (:...statuses)', {
                statuses: group.statuses,
            })
            .orderBy('deal.lastActivityAt', 'DESC')
            .skip((group.page - 1) * group.limit)
            .take(group.limit);

        qb.leftJoin(
            ChannelMembershipEntity,
            'membership',
            'membership.channelId = deal.channelId AND membership.userId = :userId AND membership.isActive = true',
            {userId},
        );

        if (role === 'advertiser') {
            qb.andWhere('deal.advertiserUserId = :userId', {userId});
        } else if (role === 'publisher') {
            qb.andWhere('membership.id IS NOT NULL');
        } else {
            qb.andWhere(
                new Brackets((builder) => {
                    builder
                        .where('deal.advertiserUserId = :userId', {userId})
                        .orWhere('membership.id IS NOT NULL');
                }),
            );
        }

        const [deals, total] = await qb.getManyAndCount();
        const dealIds = deals.map((deal) => deal.id);

        const [escrows, publications, creatives] = await Promise.all([
            this.escrowRepository.find({where: {dealId: In(dealIds)}}),
            this.publicationRepository.find({where: {dealId: In(dealIds)}}),
            this.creativeRepository.find({
                where: {dealId: In(dealIds)},
                order: {version: 'DESC'},
            }),
        ]);

        const escrowMap = new Map(escrows.map((escrow) => [escrow.dealId, escrow]));
        const publicationMap = new Map(
            publications.map((publication) => [publication.dealId, publication]),
        );
        const creativeMap = new Map<string, DealCreativeEntity>();
        for (const creative of creatives) {
            if (!creativeMap.has(creative.dealId)) {
                creativeMap.set(creative.dealId, creative);
            }
        }

        const items = deals.map((deal) =>
            this.buildDealItem(
                deal,
                creativeMap.get(deal.id) ?? null,
                escrowMap.get(deal.id) ?? null,
                publicationMap.get(deal.id) ?? null,
            ),
        );

        return {
            items,
            page: group.page,
            limit: group.limit,
            total,
        };
    }

    private buildDealItem(
        deal: DealEntity,
        creative: DealCreativeEntity | null,
        escrow: DealEscrowEntity | null,
        publication: DealPublicationEntity | null,
    ) {
        const channel = deal.channel;

        return {

            id: deal.id,
            advertiserUserId: deal.advertiserUserId,
            status: deal.status,
            stage: deal.stage,
            scheduledAt: deal.scheduledAt,
            channel: channel
                ? {
                    id: channel.id,
                    title: channel.title,
                    username: channel.username,
                }
                : null,
            listingSnapshot: deal.listingSnapshot,
            escrow: escrow
                ? {
                    status: escrow.status,
                    amountNano: escrow.amountNano,
                    paidNano: escrow.paidNano,
                    paymentAddress: escrow.paymentAddress,
                    paymentDeadlineAt: escrow.paymentDeadlineAt,
                }
                : null,
            creative: creative
                ? {
                    id: creative.id,
                    version: creative.version,
                    status: creative.status,
                    submittedAt: creative.submittedAt,
                    reviewedAt: creative.reviewedAt,
                }
                : null,
            publication: publication
                ? {
                    status: publication.status,
                    publishedMessageId: publication.publishedMessageId,
                    publishedAt: publication.publishedAt,
                    mustRemainUntil: publication.mustRemainUntil,
                    verifiedAt: publication.verifiedAt,
                    error: publication.error,
                }
                : null,
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

    private ensureTransitionAllowed(from: DealStage, to: DealStage) {
        try {
            assertTransitionAllowed(from, to);
        } catch (error) {
            if (error instanceof DealStateError) {
                throw new DealServiceError(DealErrorCode.INVALID_STATUS);
            }
            throw error;
        }
    }

    private buildActivityUpdate(now: Date) {
        return {
            lastActivityAt: now,
        };
    }

    private addMinutes(date: Date, minutes: number): Date {
        return new Date(date.getTime() + minutes * 60 * 1000);
    }

    private addHours(date: Date, hours: number): Date {
        return new Date(date.getTime() + hours * 60 * 60 * 1000);
    }

    private computeIdleExpiry(stage: DealStage, now: Date): Date | null {
        switch (stage) {
            case DealStage.CREATIVE_AWAITING_CONFIRM:
                return this.addMinutes(now, DEALS_CONFIG.DEAL_IDLE_EXPIRE_MINUTES);
            case DealStage.CREATIVE_AWAITING_SUBMIT:
            case DealStage.CREATIVE_AWAITING_FOR_CHANGES:
                return this.addMinutes(
                    now,
                    DEALS_CONFIG.CREATIVE_SUBMIT_DEADLINE_MINUTES,
                );
            case DealStage.SCHEDULING_AWAITING_SUBMIT:
            case DealStage.SCHEDULE_AWAITING_FOR_CHANGES:
                return this.addMinutes(
                    now,
                    DEALS_CONFIG.SCHEDULE_SUBMIT_DEADLINE_MINUTES,
                );
            case DealStage.SCHEDULING_AWAITING_CONFIRM:
                return this.addHours(now, DEALS_CONFIG.ADMIN_RESPONSE_DEADLINE_HOURS);
            default:
                return null;
        }
    }

    private async ensurePublisherAdmin(userId: string, deal: DealEntity) {
        const membership = await this.membershipRepository.findOne({
            where: {channelId: deal.channelId, userId, isActive: true},
        });

        if (!membership) {
            throw new DealServiceError(DealErrorCode.UNAUTHORIZED);
        }

        if (![ChannelRole.OWNER, ChannelRole.MANAGER].includes(membership.role)) {
            throw new DealServiceError(DealErrorCode.UNAUTHORIZED);
        }

        const user = await this.userRepository.findOne({where: {id: userId}});
        if (user?.telegramId) {
            try {
                await this.channelAdminRecheckService.requireChannelRights({
                    channelId: deal.channelId,
                    userId,
                    telegramId: Number(user.telegramId),
                    required: {allowManager: true},
                });
            } catch (error) {
                await this.cancelDealForAdminRightsLoss(deal);
                throw new DealServiceError(DealErrorCode.UNAUTHORIZED);
            }
        }
    }

    private async cancelDealForAdminRightsLoss(deal: DealEntity): Promise<void> {
        const now = new Date();
        await this.dealRepository.update(deal.id, {
            status: DealStatus.CANCELED,
            stage: DealStage.FINALIZED,
            cancelReason: 'ADMIN_RIGHTS_LOST',
            lastActivityAt: now,
        });

        await this.paymentsService.refundEscrow(
            deal.id,
            'ADMIN_RIGHTS_LOST',
        );

        await this.dealsNotificationsService.notifyAdvertiser(
            deal,
            'telegram.deal.canceled.admin_rights_lost',
        );
    }
}
