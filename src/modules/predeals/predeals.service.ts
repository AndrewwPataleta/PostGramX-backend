import {forwardRef, Inject, Injectable, Logger} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {InjectRepository} from '@nestjs/typeorm';
import {DataSource, In, Repository} from 'typeorm';
import {ListingEntity} from '../listings/entities/listing.entity';
import {ChannelEntity} from '../channels/entities/channel.entity';
import {ChannelMembershipEntity} from '../channels/entities/channel-membership.entity';
import {ChannelRole} from '../channels/types/channel-role.enum';
import {User} from '../auth/entities/user.entity';
import {DealEntity} from '../deals/entities/deal.entity';
import {DealEscrowStatus} from '../deals/types/deal-escrow-status.enum';
import {DealInitiatorSide} from '../deals/types/deal-initiator-side.enum';
import {DealStatus} from '../deals/types/deal-status.enum';
import {WalletsService} from '../payments/wallets/wallets.service';
import {EscrowWalletEntity} from '../payments/entities/escrow-wallet.entity';
import {ChannelParticipantsService} from '../channels/channel-participants.service';
import {TelegramBotService} from '../telegram-bot/telegram-bot.service';
import {PreDealEntity} from './entities/pre-deal.entity';
import {PreDealCreativeEntity} from './entities/pre-deal-creative.entity';
import {PreDealParticipantEntity} from './entities/pre-deal-participant.entity';
import {PreDealStatus} from './types/predeal-status.enum';
import {PreDealListingSnapshot} from './types/predeal-listing-snapshot.type';
import {PreDealParticipantRole} from './types/predeal-participant-role.enum';
import {
    PreDealErrorCode,
    PreDealServiceError,
} from './errors/predeal-service.error';
import {PreDealsDeepLinkService} from './predeals-deep-link.service';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

@Injectable()
export class PreDealsService {
    private readonly logger = new Logger(PreDealsService.name);

    constructor(
        private readonly dataSource: DataSource,
        private readonly configService: ConfigService,
        private readonly deepLinkService: PreDealsDeepLinkService,
        private readonly walletsService: WalletsService,
        private readonly participantsService: ChannelParticipantsService,
        @Inject(forwardRef(() => TelegramBotService))
        private readonly telegramBotService: TelegramBotService,
        @InjectRepository(PreDealEntity)
        private readonly preDealRepository: Repository<PreDealEntity>,
        @InjectRepository(PreDealCreativeEntity)
        private readonly creativeRepository: Repository<PreDealCreativeEntity>,
        @InjectRepository(PreDealParticipantEntity)
        private readonly preDealParticipantRepository: Repository<PreDealParticipantEntity>,
        @InjectRepository(ListingEntity)
        private readonly listingRepository: Repository<ListingEntity>,
        @InjectRepository(ChannelEntity)
        private readonly channelRepository: Repository<ChannelEntity>,
        @InjectRepository(ChannelMembershipEntity)
        private readonly membershipRepository: Repository<ChannelMembershipEntity>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        @InjectRepository(DealEntity)
        private readonly dealRepository: Repository<DealEntity>,
        @InjectRepository(EscrowWalletEntity)
        private readonly escrowWalletRepository: Repository<EscrowWalletEntity>,
    ) {}

    async createPreDeal(userId: string, listingId: string, scheduledAt: string) {
        const listing = await this.listingRepository.findOne({
            where: {id: listingId},
        });

        if (!listing) {
            throw new PreDealServiceError(PreDealErrorCode.LISTING_NOT_FOUND);
        }

        if (!listing.isActive) {
            throw new PreDealServiceError(PreDealErrorCode.LISTING_DISABLED);
        }

        const channel = await this.channelRepository.findOne({
            where: {id: listing.channelId},
        });

        if (!channel) {
            throw new PreDealServiceError(PreDealErrorCode.LISTING_NOT_FOUND);
        }

        if (channel.createdByUserId === userId) {
            throw new PreDealServiceError(PreDealErrorCode.SELF_DEAL_NOT_ALLOWED);
        }

        if (listing.createdByUserId === userId) {
            throw new PreDealServiceError(PreDealErrorCode.SELF_DEAL_NOT_ALLOWED);
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
            throw new PreDealServiceError(PreDealErrorCode.SELF_DEAL_NOT_ALLOWED);
        }

        const parsedScheduledAt = new Date(scheduledAt);
        if (!Number.isFinite(parsedScheduledAt.getTime())) {
            throw new PreDealServiceError(PreDealErrorCode.INVALID_SCHEDULE_TIME);
        }

        if (parsedScheduledAt.getTime() <= Date.now()) {
            throw new PreDealServiceError(PreDealErrorCode.INVALID_SCHEDULE_TIME);
        }

        const now = new Date();
        const listingSnapshot = this.buildListingSnapshot(listing, now);
        const expiresAt = this.calculateStallExpiry(now);

        const preDeal = await this.dataSource.transaction(async (manager) => {
            const repo = manager.getRepository(PreDealEntity);
            const participantRepo = manager.getRepository(PreDealParticipantEntity);

            const created = repo.create({
                listingId: listing.id,
                channelId: listing.channelId,
                advertiserUserId: userId,
                status: PreDealStatus.AWAITING_CREATIVE,
                scheduledAt: parsedScheduledAt,
                listingSnapshot,
                expectedAmountNano: listing.priceNano,
                lastActivityAt: now,
                expiresAt,
            });

            const saved = await repo.save(created);

            const participant = participantRepo.create({
                preDealId: saved.id,
                userId,
                role: PreDealParticipantRole.ADVERTISER,
                isActive: false,
            });
            await participantRepo.save(participant);

            return saved;
        });

        return {
            id: preDeal.id,
            status: preDeal.status,
            listingId: preDeal.listingId,
            channelId: preDeal.channelId,
            scheduledAt: preDeal.scheduledAt,
            botInstructions: {
                startUrl: this.deepLinkService.buildBotStartLink(preDeal.id),
                message:
                    'Send your ad post to the bot. After you send it, you will be asked to confirm.',
            },
        };
    }

    async getPreDeal(userId: string, preDealId: string) {
        const preDeal = await this.preDealRepository.findOne({
            where: {id: preDealId},
        });

        if (!preDeal) {
            throw new PreDealServiceError(PreDealErrorCode.PREDEAL_NOT_FOUND);
        }

        if (preDeal.advertiserUserId !== userId) {
            throw new PreDealServiceError(
                PreDealErrorCode.UNAUTHORIZED_PREDEAL_ACCESS,
            );
        }

        const listingSummary = this.buildListingSummary(preDeal.listingSnapshot);
        const deal = preDeal.dealId
            ? await this.dealRepository.findOne({
                  where: {id: preDeal.dealId},
              })
            : null;
        const escrowWallet = deal?.escrowWalletId
            ? await this.escrowWalletRepository.findOne({
                  where: {id: deal.escrowWalletId},
              })
            : null;

        return {
            id: preDeal.id,
            status: preDeal.status,
            scheduledAt: preDeal.scheduledAt,
            listing: listingSummary,
            paymentWindowSeconds: preDeal.paymentWindowSeconds,
            paymentExpiresAt: preDeal.paymentExpiresAt,
            payment: deal
                ? {
                      dealId: deal.id,
                      escrowAddress: escrowWallet?.address ?? null,
                      expectedAmountNano: deal.escrowAmountNano,
                      paymentStatus: deal.escrowStatus,
                  }
                : null,
            botInstructions: {
                startUrl: this.deepLinkService.buildBotStartLink(preDeal.id),
                message:
                    'Send your ad post to the bot. After you send it, you will be asked to confirm.',
            },
        };
    }

    async listPreDeals(
        userId: string,
        options: {status?: PreDealStatus; page?: number; limit?: number},
    ) {
        const page = options.page ?? DEFAULT_PAGE;
        const limit = options.limit ?? DEFAULT_LIMIT;

        const qb = this.preDealRepository
            .createQueryBuilder('predeal')
            .where('predeal.advertiserUserId = :userId', {userId})
            .orderBy('predeal.lastActivityAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit);

        if (options.status) {
            qb.andWhere('predeal.status = :status', {status: options.status});
        }

        const [items, total] = await qb.getManyAndCount();
        const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

        return {
            items: items.map((preDeal) => ({
                id: preDeal.id,
                status: preDeal.status,
                scheduledAt: preDeal.scheduledAt,
                listing: this.buildListingSummary(preDeal.listingSnapshot),
                paymentWindowSeconds: preDeal.paymentWindowSeconds,
                paymentExpiresAt: preDeal.paymentExpiresAt,
            })),
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
        };
    }

    async cancelPreDeal(userId: string, preDealId: string) {
        const preDeal = await this.preDealRepository.findOne({
            where: {id: preDealId},
        });

        if (!preDeal) {
            throw new PreDealServiceError(PreDealErrorCode.PREDEAL_NOT_FOUND);
        }

        if (preDeal.advertiserUserId !== userId) {
            throw new PreDealServiceError(
                PreDealErrorCode.UNAUTHORIZED_PREDEAL_ACCESS,
            );
        }

        if (!this.canCancelPreDeal(preDeal.status)) {
            throw new PreDealServiceError(PreDealErrorCode.INVALID_STATUS);
        }

        const now = new Date();
        await this.preDealRepository.update(preDeal.id, {
            status: PreDealStatus.CANCELED,
            lastActivityAt: now,
            expiresAt: now,
        });

        await this.preDealParticipantRepository.update(
            {
                preDealId: preDeal.id,
                role: PreDealParticipantRole.ADVERTISER,
            },
            {isActive: false},
        );

        const advertiser = await this.userRepository.findOne({
            where: {id: preDeal.advertiserUserId},
        });
        if (advertiser?.telegramId) {
            await this.telegramBotService.sendMessage(
                advertiser.telegramId,
                'Pre-deal canceled. You can create a new request in the Mini App.',
            );
        }

        return {id: preDeal.id, status: PreDealStatus.CANCELED};
    }

    async handleBotStart(telegramUserId: string, chatId: string, preDealId: string) {
        const user = await this.userRepository.findOne({
            where: {telegramId: telegramUserId},
        });

        if (!user) {
            return {
                ok: false,
                message: 'Please connect your account via the Mini App first.',
            };
        }

        const preDeal = await this.preDealRepository.findOne({
            where: {id: preDealId},
        });

        if (!preDeal || preDeal.advertiserUserId !== user.id) {
            return {ok: false, message: 'Pre-deal not found or access denied.'};
        }

        if (preDeal.status !== PreDealStatus.AWAITING_ADVERTISER_CONFIRMATION) {
            return {ok: false, message: 'Pre-deal is not awaiting confirmation.'};
        }

        if (
            [
                PreDealStatus.CANCELED,
                PreDealStatus.REJECTED,
                PreDealStatus.EXPIRED,
            ].includes(preDeal.status)
        ) {
            return {
                ok: false,
                message: `Pre-deal is ${preDeal.status.toLowerCase().replace('_', ' ')}.`,
            };
        }

        await this.dataSource.transaction(async (manager) => {
            await manager.getRepository(PreDealParticipantEntity).update(
                {
                    userId: user.id,
                    role: PreDealParticipantRole.ADVERTISER,
                },
                {isActive: false},
            );

            await manager.getRepository(PreDealParticipantEntity).upsert(
                {
                    preDealId: preDeal.id,
                    userId: user.id,
                    role: PreDealParticipantRole.ADVERTISER,
                    telegramUserId,
                    telegramChatId: chatId,
                    isActive: true,
                },
                ['preDealId', 'userId', 'role'],
            );

            await manager.getRepository(PreDealEntity).update(preDeal.id, {
                lastActivityAt: new Date(),
            });
        });

        return {
            ok: true,
            message: 'Send the post for this deal (text or media).',
        };
    }

    async handleCreativeMessage(params: {
        telegramUserId: string;
        chatId: string;
        messageId: number;
        text?: string | null;
        attachments?: Array<Record<string, unknown>> | null;
    }) {
        const user = await this.userRepository.findOne({
            where: {telegramId: params.telegramUserId},
        });

        if (!user) {
            return {handled: false};
        }

        const participant = await this.preDealParticipantRepository.findOne({
            where: {
                userId: user.id,
                role: PreDealParticipantRole.ADVERTISER,
                isActive: true,
            },
        });

        if (!participant) {
            return {handled: false};
        }

        const preDeal = await this.preDealRepository.findOne({
            where: {id: participant.preDealId},
        });

        if (!preDeal) {
            return {handled: false};
        }

        if (preDeal.status !== PreDealStatus.AWAITING_CREATIVE) {
            return {
                handled: true,
                message: 'This pre-deal is not ready for creative yet.',
            };
        }

        const now = new Date();
        await this.dataSource.transaction(async (manager) => {
            const creativeRepo = manager.getRepository(PreDealCreativeEntity);
            const preDealRepo = manager.getRepository(PreDealEntity);

            const creative = creativeRepo.create({
                preDealId: preDeal.id,
                fromUserId: user.id,
                telegramChatId: params.chatId,
                telegramMessageId: String(params.messageId),
                text: params.text ?? null,
                attachments: params.attachments ?? null,
            });
            await creativeRepo.save(creative);

            await preDealRepo.update(preDeal.id, {
                status: PreDealStatus.AWAITING_ADVERTISER_CONFIRMATION,
                lastActivityAt: now,
                expiresAt: this.calculateStallExpiry(now),
            });
        });

        return {
            handled: true,
            message: 'Preview received. Is everything correct?',
            preDealId: preDeal.id,
        };
    }

    async handleAdvertiserConfirm(telegramUserId: string, preDealId: string) {
        const user = await this.userRepository.findOne({
            where: {telegramId: telegramUserId},
        });

        if (!user) {
            return {ok: false, message: 'Account not linked.'};
        }

        const preDeal = await this.preDealRepository.findOne({
            where: {id: preDealId},
        });

        if (!preDeal || preDeal.advertiserUserId !== user.id) {
            return {ok: false, message: 'Pre-deal not found or access denied.'};
        }

        if (preDeal.status !== PreDealStatus.AWAITING_ADVERTISER_CONFIRMATION) {
            return {ok: false, message: 'Pre-deal is not awaiting confirmation.'};
        }

        const now = new Date();
        await this.preDealRepository.update(preDeal.id, {
            status: PreDealStatus.AWAITING_PUBLISHER_APPROVAL,
            advertiserConfirmedAt: now,
            lastActivityAt: now,
            expiresAt: this.calculateStallExpiry(now),
        });

        const advertiser = await this.userRepository.findOne({
            where: {id: preDeal.advertiserUserId},
        });

        if (advertiser?.telegramId) {
            await this.telegramBotService.sendMessage(
                advertiser.telegramId,
                'Sent to channel admin for approval.',
            );
        }

        await this.notifyPublisherAdmins(preDeal);

        return {ok: true, message: 'Sent to channel admin for approval.'};
    }

    async handleAdvertiserResend(telegramUserId: string, preDealId: string) {
        const user = await this.userRepository.findOne({
            where: {telegramId: telegramUserId},
        });

        if (!user) {
            return {ok: false, message: 'Account not linked.'};
        }

        const preDeal = await this.preDealRepository.findOne({
            where: {id: preDealId},
        });

        if (!preDeal || preDeal.advertiserUserId !== user.id) {
            return {ok: false, message: 'Pre-deal not found or access denied.'};
        }

        const now = new Date();
        await this.preDealRepository.update(preDeal.id, {
            status: PreDealStatus.AWAITING_CREATIVE,
            lastActivityAt: now,
            expiresAt: this.calculateStallExpiry(now),
        });

        return {ok: true, message: 'Send a new creative message.'};
    }

    async handleAdvertiserCancel(telegramUserId: string, preDealId: string) {
        const user = await this.userRepository.findOne({
            where: {telegramId: telegramUserId},
        });

        if (!user) {
            return {ok: false, message: 'Account not linked.'};
        }

        const preDeal = await this.preDealRepository.findOne({
            where: {id: preDealId},
        });

        if (!preDeal || preDeal.advertiserUserId !== user.id) {
            return {ok: false, message: 'Pre-deal not found or access denied.'};
        }

        if (!this.canCancelPreDeal(preDeal.status)) {
            return {ok: false, message: 'Pre-deal cannot be canceled now.'};
        }

        const now = new Date();
        await this.preDealRepository.update(preDeal.id, {
            status: PreDealStatus.CANCELED,
            lastActivityAt: now,
            expiresAt: now,
        });

        await this.preDealParticipantRepository.update(
            {
                preDealId: preDeal.id,
                role: PreDealParticipantRole.ADVERTISER,
            },
            {isActive: false},
        );

        return {ok: true, message: 'Pre-deal canceled.'};
    }

    async handlePublisherApprove(telegramUserId: string, preDealId: string) {
        const user = await this.userRepository.findOne({
            where: {telegramId: telegramUserId},
        });

        if (!user) {
            return {ok: false, message: 'Account not linked.'};
        }

        const preDeal = await this.preDealRepository.findOne({
            where: {id: preDealId},
        });

        if (!preDeal) {
            return {ok: false, message: 'Pre-deal not found.'};
        }

        const isAdmin = await this.isChannelAdmin(preDeal.channelId, user.id);
        if (!isAdmin) {
            return {ok: false, message: 'You are not an admin for this channel.'};
        }

        if (preDeal.status !== PreDealStatus.AWAITING_PUBLISHER_APPROVAL) {
            return {ok: false, message: 'Pre-deal is not awaiting approval.'};
        }

        const now = new Date();
        await this.preDealRepository.update(preDeal.id, {
            status: PreDealStatus.AWAITING_PAYMENT_WINDOW,
            publisherApprovedAt: now,
            publisherDecisionByTelegramId: telegramUserId,
            lastActivityAt: now,
            expiresAt: this.calculateStallExpiry(now),
        });

        await this.notifyAdvertiser(preDeal, 'Admin approved. Awaiting payment window.');

        return {
            ok: true,
            message: 'Choose payment window for advertiser to pay.',
            requestPaymentWindow: true,
        };
    }

    async handlePublisherReject(telegramUserId: string, preDealId: string) {
        const user = await this.userRepository.findOne({
            where: {telegramId: telegramUserId},
        });

        if (!user) {
            return {ok: false, message: 'Account not linked.'};
        }

        const preDeal = await this.preDealRepository.findOne({
            where: {id: preDealId},
        });

        if (!preDeal) {
            return {ok: false, message: 'Pre-deal not found.'};
        }

        const isAdmin = await this.isChannelAdmin(preDeal.channelId, user.id);
        if (!isAdmin) {
            return {ok: false, message: 'You are not an admin for this channel.'};
        }

        if (preDeal.status !== PreDealStatus.AWAITING_PUBLISHER_APPROVAL) {
            return {ok: false, message: 'Pre-deal is not awaiting approval.'};
        }

        const now = new Date();
        await this.preDealRepository.update(preDeal.id, {
            status: PreDealStatus.REJECTED,
            publisherRejectedAt: now,
            publisherDecisionByTelegramId: telegramUserId,
            lastActivityAt: now,
            expiresAt: now,
        });

        await this.notifyAdvertiser(preDeal, 'Pre-deal rejected by admin.');

        return {ok: true, message: 'Pre-deal rejected.'};
    }

    async handlePaymentWindowSelection(
        telegramUserId: string,
        preDealId: string,
        windowSeconds: number,
    ) {
        const user = await this.userRepository.findOne({
            where: {telegramId: telegramUserId},
        });

        if (!user) {
            return {ok: false, message: 'Account not linked.'};
        }

        const preDeal = await this.preDealRepository.findOne({
            where: {id: preDealId},
        });

        if (!preDeal) {
            return {ok: false, message: 'Pre-deal not found.'};
        }

        const isAdmin = await this.isChannelAdmin(preDeal.channelId, user.id);
        if (!isAdmin) {
            return {ok: false, message: 'You are not an admin for this channel.'};
        }

        if (preDeal.status !== PreDealStatus.AWAITING_PAYMENT_WINDOW) {
            return {ok: false, message: 'Pre-deal is not awaiting payment window.'};
        }

        const now = new Date();
        const paymentExpiresAt = new Date(now.getTime() + windowSeconds * 1000);

        const {deal, wallet} = await this.dataSource.transaction(async (manager) => {
            const preDealRepo = manager.getRepository(PreDealEntity);

            await preDealRepo.update(preDeal.id, {
                status: PreDealStatus.READY_FOR_PAYMENT,
                paymentWindowSeconds: windowSeconds,
                paymentExpiresAt,
                lastActivityAt: now,
                expiresAt: paymentExpiresAt,
            });

            const dealRecord = await this.createDealFromPreDeal(preDeal, paymentExpiresAt, manager);

            return dealRecord;
        });

        const paymentLink = this.deepLinkService.buildPaymentLink(preDeal.id);
        const windowLabel =
            windowSeconds % 86400 === 0
                ? `${windowSeconds / 86400} day`
                : `${windowSeconds / 3600} hour`;
        await this.notifyAdvertiser(
            preDeal,
            `Admin approved ✅. Payment window: ${windowLabel}. Please pay before it expires.`,
            {
                inline_keyboard: [[{text: '💎 Open Mini App to Pay', url: paymentLink}]],
            },
        );

        return {
            ok: true,
            message: 'Payment window set. Advertiser notified.',
            dealId: deal.id,
            escrowAddress: wallet.address,
            paymentExpiresAt,
        };
    }

    async notifyExpired(preDeal: PreDealEntity, reason: string) {
        await this.preDealRepository.update(preDeal.id, {
            status: PreDealStatus.EXPIRED,
            lastActivityAt: new Date(),
            expiresAt: new Date(),
        });

        await this.preDealParticipantRepository.update(
            {
                preDealId: preDeal.id,
                role: PreDealParticipantRole.ADVERTISER,
            },
            {isActive: false},
        );

        await this.notifyAdvertiser(preDeal, `Pre-deal expired: ${reason}.`);

        if (preDeal.channelId) {
            const admins = await this.participantsService.getNotificationRecipients(
                preDeal.channelId,
            );
            for (const admin of admins) {
                await this.telegramBotService.sendMessage(
                    admin.telegramId as string,
                    `Pre-deal ${preDeal.id.slice(0, 8)} expired: ${reason}.`,
                );
            }
        }
    }

    private async notifyAdvertiser(
        preDeal: PreDealEntity,
        message: string,
        replyMarkup?: {inline_keyboard: Array<Array<{text: string; url?: string}>>},
    ) {
        const advertiser = await this.userRepository.findOne({
            where: {id: preDeal.advertiserUserId},
        });

        if (!advertiser?.telegramId) {
            return;
        }

        await this.telegramBotService.sendMessage(advertiser.telegramId, message, {
            reply_markup: replyMarkup,
        });
    }

    private async notifyPublisherAdmins(preDeal: PreDealEntity) {
        const channel = await this.channelRepository.findOne({
            where: {id: preDeal.channelId},
        });

        if (!channel) {
            return;
        }

        const listingSummary = this.buildListingSummary(preDeal.listingSnapshot);
        const creative = await this.creativeRepository.findOne({
            where: {preDealId: preDeal.id},
            order: {createdAt: 'DESC'},
        });
        const creativeText = creative?.text?.trim() ?? '';
        const attachments = creative?.attachments ?? [];
        const attachmentLine =
            attachments.length > 0
                ? `Attachments: ${attachments.length}`
                : 'Attachments: none';

        const message = [
            'New pre-deal creative to review',
            channel.username
                ? `Channel: ${channel.title} (@${channel.username})`
                : `Channel: ${channel.title}`,
            `Scheduled: ${preDeal.scheduledAt.toISOString()}`,
            `Price: ${listingSummary?.priceNano ?? 'n/a'} TON`,
            `Rules: ${listingSummary?.rules ?? 'n/a'}`,
            creativeText ? `Text: ${creativeText}` : 'Text: (no text)',
            attachmentLine,
            `Pre-deal: ${preDeal.id.slice(0, 8)}`,
        ].join('\n');

        const keyboard = {
            inline_keyboard: [
                [
                    {text: '✅ Approve', callback_data: `predeal_approve:${preDeal.id}`},
                    {text: '❌ Reject', callback_data: `predeal_reject:${preDeal.id}`},
                ],
            ],
        };

        const recipients = await this.participantsService.getNotificationRecipients(
            preDeal.channelId,
        );

        if (recipients.length === 0) {
            this.logger.warn(
                `No publisher admins found for predeal ${preDeal.id} channel=${preDeal.channelId}`,
            );
            return;
        }

        for (const recipient of recipients) {
            if (!recipient.telegramId) {
                continue;
            }
            await this.telegramBotService.sendMessage(
                recipient.telegramId,
                message,
                {
                    reply_markup: keyboard,
                },
            );
        }
    }

    private async createDealFromPreDeal(
        preDeal: PreDealEntity,
        paymentExpiresAt: Date,
        manager = this.dataSource.manager,
    ) {
        if (preDeal.dealId) {
            const existing = await manager.getRepository(DealEntity).findOne({
                where: {id: preDeal.dealId},
            });
            const existingWallet = existing?.escrowWalletId
                ? await manager.getRepository(EscrowWalletEntity).findOne({
                      where: {id: existing.escrowWalletId},
                  })
                : null;
            if (existing && existingWallet) {
                return {deal: existing, wallet: existingWallet};
            }
        }

        const channel = await manager.getRepository(ChannelEntity).findOne({
            where: {id: preDeal.channelId},
        });

        if (!channel) {
            throw new PreDealServiceError(PreDealErrorCode.LISTING_NOT_FOUND);
        }

        const dealRepo = manager.getRepository(DealEntity);
        const amountNano = preDeal.expectedAmountNano ?? preDeal.listingSnapshot?.priceNano;
        const deal = dealRepo.create({
            listingId: preDeal.listingId,
            channelId: preDeal.channelId,
            advertiserUserId: preDeal.advertiserUserId,
            publisherOwnerUserId: channel.createdByUserId,
            createdByUserId: preDeal.advertiserUserId,
            sideInitiator: DealInitiatorSide.ADVERTISER,
            status: DealStatus.PENDING,
            escrowStatus: DealEscrowStatus.AWAITING_PAYMENT,
            escrowAmountNano: amountNano,
            escrowCurrency: preDeal.listingSnapshot?.currency ?? 'TON',
            escrowExpiresAt: paymentExpiresAt,
            listingSnapshot: preDeal.listingSnapshot,
            offerSnapshot: this.buildOfferSnapshot(preDeal.listingSnapshot),
            scheduledAt: preDeal.scheduledAt,
            lastActivityAt: new Date(),
        });

        const savedDeal = await dealRepo.save(deal);
        const wallet = await this.walletsService.createDealEscrowWallet(
            savedDeal.id,
            manager,
        );

        await dealRepo.update(savedDeal.id, {
            escrowWalletId: wallet.id,
        });

        await manager.getRepository(PreDealEntity).update(preDeal.id, {
            dealId: savedDeal.id,
        });

        return {deal: {...savedDeal, escrowWalletId: wallet.id}, wallet};
    }

    private buildListingSnapshot(
        listing: ListingEntity,
        snapshotAt: Date,
    ): PreDealListingSnapshot {
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
            version: listing.version,
            snapshotAt: snapshotAt.toISOString(),
        };
    }

    private buildOfferSnapshot(snapshot: PreDealListingSnapshot) {
        return {
            priceNano: snapshot.priceNano,
            currency: snapshot.currency,
            format: snapshot.format,
            pinDurationHours: snapshot.pinDurationHours,
            visibilityDurationHours: snapshot.visibilityDurationHours,
            allowEdits: snapshot.allowEdits,
            allowLinkTracking: snapshot.allowLinkTracking,
            allowPinnedPlacement: snapshot.allowPinnedPlacement,
            requiresApproval: snapshot.requiresApproval,
            contentRulesText: snapshot.contentRulesText,
            tags: snapshot.tags,
            isActive: true,
        };
    }

    private buildListingSummary(snapshot?: PreDealListingSnapshot | null) {
        if (!snapshot) {
            return null;
        }

        return {
            priceNano: snapshot.priceNano,
            tags: snapshot.tags,
            rules: snapshot.contentRulesText,
            placementHours: snapshot.visibilityDurationHours,
            pinDurationHours: snapshot.pinDurationHours,
            lifetimeHours: snapshot.visibilityDurationHours,
        };
    }

    private calculateStallExpiry(from: Date): Date {
        const stallHours = Number(
            this.configService.get<string>('PREDEAL_STALL_TIMEOUT_HOURS') ?? 24,
        );
        const expires = new Date(from.getTime());
        expires.setHours(expires.getHours() + stallHours);
        return expires;
    }

    private canCancelPreDeal(status: PreDealStatus): boolean {
        return [
            PreDealStatus.AWAITING_CREATIVE,
            PreDealStatus.AWAITING_ADVERTISER_CONFIRMATION,
            PreDealStatus.AWAITING_PUBLISHER_APPROVAL,
        ].includes(status);
    }

    private async isChannelAdmin(channelId: string, userId: string) {
        const channel = await this.channelRepository.findOne({
            where: {id: channelId},
        });

        if (!channel) {
            return false;
        }

        if (channel.createdByUserId === userId) {
            return true;
        }

        const count = await this.membershipRepository.count({
            where: {
                channelId,
                userId,
                isActive: true,
                role: In([ChannelRole.OWNER, ChannelRole.MANAGER]),
            },
        });

        return count > 0;
    }
}
