import {Injectable, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {ConfigService} from '@nestjs/config';
import {Repository} from 'typeorm';
import {DealEntity} from '../../modules/deals/entities/deal.entity';
import {DealCreativeEntity} from '../../modules/deals/entities/deal-creative.entity';
import {ChannelEntity} from '../../modules/channels/entities/channel.entity';
import {DealEscrowStatus} from '../../common/constants/deals/deal-escrow-status.constants';
import {DealStatus} from '../../common/constants/deals/deal-status.constants';
import {assertTransitionAllowed} from '../../modules/deals/state/deal-state.machine';
import {mapEscrowToDealStatus} from '../../modules/deals/state/deal-status.mapper';
import {TelegramPosterService} from './telegram-poster.service';
import {DEAL_DELIVERY_CONFIG} from '../../config/deal-delivery.config';
import {PaymentsService} from '../../modules/payments/payments.service';
import {ChannelParticipantsService} from '../../modules/channels/channel-participants.service';
import {TelegramBotService} from '../../modules/telegram-bot/telegram-bot.service';
import {User} from '../../modules/auth/entities/user.entity';
import {logMeta} from '../../common/logging/logContext';
import {durationMs, nowMs} from '../../common/logging/time';

@Injectable()
export class DealsDeliveryService {
    private readonly logger = new Logger(DealsDeliveryService.name);

    constructor(
        private readonly configService: ConfigService,
        @InjectRepository(DealEntity)
        private readonly dealRepository: Repository<DealEntity>,
        @InjectRepository(DealCreativeEntity)
        private readonly creativeRepository: Repository<DealCreativeEntity>,
        @InjectRepository(ChannelEntity)
        private readonly channelRepository: Repository<ChannelEntity>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly telegramPosterService: TelegramPosterService,
        private readonly paymentsService: PaymentsService,
        private readonly channelParticipantsService: ChannelParticipantsService,
        private readonly telegramBotService: TelegramBotService,
    ) {}

    async processScheduledDeals(
        runId: string,
    ): Promise<{
        processed: number;
        posted: number;
        skipped: number;
        failed: number;
    }> {
        const overallStartMs = nowMs();
        const now = new Date();
        const lookaheadSeconds =
            DEAL_DELIVERY_CONFIG.POSTING_LOOKAHEAD_SECONDS;
        const cutoff = new Date(now.getTime() + lookaheadSeconds * 1000);

        const selectStartMs = nowMs();
        const deals = await this.dealRepository
            .createQueryBuilder('deal')
            .where('deal.status = :status', {status: DealStatus.ACTIVE})
            .andWhere('deal.escrowStatus = :escrowStatus', {
                escrowStatus: DealEscrowStatus.APPROVED_SCHEDULED,
            })
            .andWhere('deal.scheduledAt IS NOT NULL')
            .andWhere('deal.scheduledAt <= :cutoff', {cutoff})
            .orderBy('deal.scheduledAt', 'ASC')
            .addOrderBy('deal.createdAt', 'ASC')
            .limit(20)
            .getMany();

        this.logger.log(
            'delivery.cron.selected',
            logMeta({
                runId,
                count: deals.length,
                selectMs: durationMs(selectStartMs),
                dealIds: deals.slice(0, 50).map((deal) => deal.id),
            }),
        );

        let processed = 0;
        let posted = 0;
        let skipped = 0;
        let failed = 0;

        for (const deal of deals) {
            const traceId = `${runId}-${deal.id.slice(0, 8)}`;
            const lockStartMs = nowMs();
            const locked = await this.lockDealForPosting(deal.id, now);
            if (!locked) {
                skipped += 1;
                this.logger.warn(
                    'delivery.deal.lock.skip',
                    logMeta({
                        runId,
                        traceId,
                        dealId: deal.id,
                        reason: 'already_processing_or_not_ready',
                        ms: durationMs(lockStartMs),
                    }),
                );
                continue;
            }
            this.logger.log(
                'delivery.deal.lock',
                logMeta({
                    runId,
                    traceId,
                    dealId: deal.id,
                    ok: true,
                    ms: durationMs(lockStartMs),
                }),
            );
            this.logger.log(
                'delivery.deal.picked',
                logMeta({
                    runId,
                    traceId,
                    dealId: deal.id,
                    scheduledAt: deal.scheduledAt?.toISOString() ?? null,
                    escrowStatus: deal.escrowStatus,
                    channelId: deal.channelId ?? null,
                }),
            );
            const result = await this.processDealPosting(deal.id, runId, traceId);
            processed += 1;
            if (result.outcome === 'posted') {
                posted += 1;
            } else if (result.outcome === 'skipped') {
                skipped += 1;
            } else {
                failed += 1;
            }
        }

        this.logger.log(
            'delivery.cron.processed',
            logMeta({
                runId,
                totalMs: durationMs(overallStartMs),
                processed,
                posted,
                skipped,
                failed,
            }),
        );

        return {processed, posted, skipped, failed};
    }

    async processDealPosting(
        dealId: string,
        runId: string,
        traceId: string,
    ): Promise<{outcome: 'posted' | 'skipped' | 'failed'}> {
        const startMs = nowMs();
        let currentStep = 'load';
        try {
            const deal = await this.dealRepository.findOne({
                where: {id: dealId},
                relations: ['channel'],
            });

            if (!deal) {
                this.logger.warn(
                    'delivery.deal.skip',
                    logMeta({runId, traceId, dealId, reason: 'not_found'}),
                );
                return {outcome: 'skipped'};
            }

            if (deal.escrowStatus !== DealEscrowStatus.POSTING) {
                this.logger.warn(
                    'delivery.deal.skip',
                    logMeta({
                        runId,
                        traceId,
                        dealId,
                        reason: 'escrow_status_mismatch',
                        escrowStatus: deal.escrowStatus,
                    }),
                );
                return {outcome: 'skipped'};
            }

            this.logger.log(
                'delivery.deal.start',
                logMeta({
                    runId,
                    traceId,
                    dealId: deal.id,
                    scheduledAt: deal.scheduledAt?.toISOString() ?? null,
                    escrowStatus: deal.escrowStatus,
                    channelId: deal.channelId ?? null,
                    channelUsername: deal.channel?.username ?? null,
                }),
            );

            currentStep = 'channel';
            const channel = deal.channel
                ? deal.channel
                : await this.channelRepository.findOne({
                      where: {id: deal.channelId ?? ''},
                  });

            if (!channel) {
                this.logger.error(
                    'delivery.deal.fail',
                    logMeta({
                        runId,
                        traceId,
                        dealId,
                        step: 'channel',
                        reason: 'CHANNEL_NOT_FOUND',
                        msTotal: durationMs(startMs),
                    }),
                );
                await this.failDeal(deal, 'CHANNEL_NOT_FOUND');
                return {outcome: 'failed'};
            }

            currentStep = 'creative';
            const creative = await this.creativeRepository.findOne({
                where: {dealId: deal.id},
            });

            if (!creative) {
                this.logger.error(
                    'delivery.deal.fail',
                    logMeta({
                        runId,
                        traceId,
                        dealId,
                        step: 'creative',
                        reason: 'CREATIVE_NOT_FOUND',
                        msTotal: durationMs(startMs),
                    }),
                );
                await this.failDeal(deal, 'CREATIVE_NOT_FOUND');
                return {outcome: 'failed'};
            }

            currentStep = 'rights_check';
            const rightsStartMs = nowMs();
            const rightsResult = await this.telegramPosterService.checkCanPost(
                channel,
            );
            if (!rightsResult.ok) {
                this.logger.warn(
                    'delivery.deal.rights.missing',
                    logMeta({
                        runId,
                        traceId,
                        dealId: deal.id,
                        ok: false,
                        ms: durationMs(rightsStartMs),
                        reason: rightsResult.reason,
                        channelId: channel.id,
                        channelUsername: channel.username ?? null,
                    }),
                );
                await this.cancelWithRefund(deal, channel, 'BOT_RIGHTS_MISSING');
                return {outcome: 'failed'};
            }
            this.logger.log(
                'delivery.deal.rights.check',
                logMeta({
                    runId,
                    traceId,
                    dealId: deal.id,
                    ok: true,
                    ms: durationMs(rightsStartMs),
                    details: {reason: rightsResult.reason ?? null},
                }),
            );

            currentStep = 'publish';
            const publishStartMs = nowMs();
            this.logger.log(
                'delivery.deal.publish.start',
                logMeta({
                    runId,
                    traceId,
                    dealId: deal.id,
                    creativeType: creative.type,
                    channelId: channel.id,
                    channelUsername: channel.username ?? null,
                }),
            );
            const message =
                await this.telegramPosterService.publishCreativeToChannel(
                    deal,
                    creative,
                    channel,
                );
            const publishedAt = new Date();
            this.logger.log(
                'delivery.deal.publish.success',
                logMeta({
                    runId,
                    traceId,
                    dealId: deal.id,
                    channelUsername: channel.username ?? null,
                    creativeType: creative.type,
                    scheduledAt: deal.scheduledAt?.toISOString() ?? null,
                    publishedAt: publishedAt.toISOString(),
                    messageId: message.message_id,
                    ms: durationMs(publishStartMs),
                }),
            );

            const lifetimeHours =
                deal.listingSnapshot?.visibilityDurationHours ?? 0;
            const mustRemainUntil = new Date(
                publishedAt.getTime() + lifetimeHours * 60 * 60 * 1000,
            );

            assertTransitionAllowed(
                DealEscrowStatus.POSTING,
                DealEscrowStatus.POSTED_VERIFYING,
            );

            currentStep = 'update';
            const updateStartMs = nowMs();
            await this.dealRepository.update(deal.id, {
                publishedMessageId: String(message.message_id),
                publishedAt,
                mustRemainUntil,
                deliveryError: null,
                escrowStatus: DealEscrowStatus.POSTED_VERIFYING,
                status: mapEscrowToDealStatus(DealEscrowStatus.POSTED_VERIFYING),
                lastActivityAt: publishedAt,
            });

            this.logger.log(
                'delivery.deal.update',
                logMeta({
                    runId,
                    traceId,
                    dealId: deal.id,
                    newEscrowStatus: DealEscrowStatus.POSTED_VERIFYING,
                    newStatus: mapEscrowToDealStatus(
                        DealEscrowStatus.POSTED_VERIFYING,
                    ),
                    messageId: message.message_id,
                    ms: durationMs(updateStartMs),
                }),
            );

            currentStep = 'notify';
            const notifyStartMs = nowMs();
            await this.notifyPublished(deal, channel, mustRemainUntil);
            this.logger.log(
                'delivery.deal.notify',
                logMeta({
                    runId,
                    traceId,
                    dealId: deal.id,
                    advertiserNotified: true,
                    publisherNotified: true,
                    ms: durationMs(notifyStartMs),
                }),
            );
            return {outcome: 'posted'};
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            this.logger.error(
                'delivery.deal.fail',
                logMeta({
                    runId,
                    traceId,
                    dealId,
                    step: currentStep,
                    errorMessage,
                    errorName: error instanceof Error ? error.name : undefined,
                    msTotal: durationMs(startMs),
                }),
            );
            if (error instanceof Error && error.stack) {
                const isProd =
                    this.configService.get<string>('NODE_ENV') === 'production';
                if (!isProd) {
                    this.logger.error(error.stack);
                }
            }
            await this.failDealById(dealId, errorMessage);
            return {outcome: 'failed'};
        }
    }

    private async lockDealForPosting(
        dealId: string,
        now: Date,
    ): Promise<boolean> {
        const result = await this.dealRepository
            .createQueryBuilder()
            .update(DealEntity)
            .set({
                escrowStatus: DealEscrowStatus.POSTING,
                lastActivityAt: now,
            })
            .where('id = :id', {id: dealId})
            .andWhere('escrowStatus = :escrowStatus', {
                escrowStatus: DealEscrowStatus.APPROVED_SCHEDULED,
            })
            .andWhere('status = :status', {status: DealStatus.ACTIVE})
            .execute();

        return Boolean(result.affected && result.affected > 0);
    }

    private async cancelWithRefund(
        deal: DealEntity,
        channel: ChannelEntity,
        reason: string,
    ): Promise<void> {
        const now = new Date();
        const normalizedReason = this.normalizeReason(reason);
        try {
            assertTransitionAllowed(deal.escrowStatus, DealEscrowStatus.CANCELED);
        } catch (error) {
            this.logger.warn(
                `Invalid transition for canceling dealId=${deal.id} from ${deal.escrowStatus}`,
            );
        }
        await this.dealRepository.update(deal.id, {
            status: DealStatus.CANCELED,
            escrowStatus: DealEscrowStatus.CANCELED,
            cancelReason: normalizedReason,
            deliveryError: normalizedReason,
            stalledAt: now,
            lastActivityAt: now,
        });

        await this.paymentsService.refundDealEscrow(deal.id, normalizedReason);
        await this.notifyFailure(deal, channel, normalizedReason);
    }

    private async failDeal(deal: DealEntity, reason: string): Promise<void> {
        const channel = deal.channel
            ? deal.channel
            : await this.channelRepository.findOne({
                  where: {id: deal.channelId ?? ''},
              });

        if (!channel) {
            return;
        }

        await this.cancelWithRefund(deal, channel, reason);
    }

    private async failDealById(
        dealId: string,
        errorMessage: string,
    ): Promise<void> {
        const deal = await this.dealRepository.findOne({
            where: {id: dealId},
            relations: ['channel'],
        });

        if (!deal || !deal.channel) {
            return;
        }

        await this.cancelWithRefund(deal, deal.channel, errorMessage);
    }

    private async notifyPublished(
        deal: DealEntity,
        channel: ChannelEntity,
        mustRemainUntil: Date,
    ): Promise<void> {
        const channelLabel = channel.username
            ? `@${channel.username}`
            : channel.title;
        const dealShortId = deal.id.slice(0, 8);
        const link = this.buildDealLink(deal.id);
        const mustRemainLine = mustRemainUntil.toISOString().replace('T', ' ');

        await this.notifyAdvertiser(
            deal,
            `✅ Deal ${dealShortId} published to ${channelLabel}. ` +
                `We will verify it stays live until ${mustRemainLine} UTC.`,
            link,
        );

        await this.notifyPublisherAdmins(
            deal,
            channel,
            `✅ Deal ${dealShortId} published to ${channelLabel}.`,
            link,
        );
    }

    private async notifyFailure(
        deal: DealEntity,
        channel: ChannelEntity,
        reason: string,
    ): Promise<void> {
        const channelLabel = channel.username
            ? `@${channel.username}`
            : channel.title;
        const dealShortId = deal.id.slice(0, 8);
        const link = this.buildDealLink(deal.id);

        await this.notifyAdvertiser(
            deal,
            `❌ Deal ${dealShortId} could not be published to ${channelLabel}. ` +
                `Reason: ${reason}. Your funds will be refunded.`,
            link,
        );

        await this.notifyPublisherAdmins(
            deal,
            channel,
            `⚠️ Deal ${dealShortId} canceled: ${reason}. ` +
                'Please re-add the bot as admin to continue future deals.',
            link,
        );
    }

    private async notifyAdvertiser(
        deal: DealEntity,
        message: string,
        link: string,
    ): Promise<void> {
        const advertiser = await this.userRepository.findOne({
            where: {id: deal.advertiserUserId},
        });

        if (!advertiser?.telegramId) {
            return;
        }

        await this.telegramBotService.sendMessage(advertiser.telegramId, message, {
            reply_markup: {inline_keyboard: [[{text: 'Open deal', url: link}]]},
        });
    }

    private async notifyPublisherAdmins(
        deal: DealEntity,
        channel: ChannelEntity,
        message: string,
        link: string,
    ): Promise<void> {
        const recipients =
            await this.channelParticipantsService.getNotificationRecipients(
                channel.id,
            );

        for (const recipient of recipients) {
            if (!recipient.telegramId) {
                continue;
            }
            await this.telegramBotService.sendMessage(
                recipient.telegramId,
                message,
                {
                    reply_markup: {
                        inline_keyboard: [[{text: 'Open deal', url: link}]],
                    },
                },
            );
        }
    }

    private buildDealLink(dealId: string): string {
        const botUsername = this.configService.get<string>('TELEGRAM_BOT_USERNAME');
        const miniAppShortName = this.configService.get<string>(
            'TELEGRAM_MINIAPP_SHORT_NAME',
        );
        const baseUrl = this.configService.get<string>('TELEGRAM_MINI_APP_URL');
        const startParam = `deal_${dealId}`;

        if (botUsername && miniAppShortName) {
            return `https://t.me/${botUsername}/${miniAppShortName}?startapp=${startParam}`;
        }

        if (botUsername) {
            return `https://t.me/${botUsername}?startapp=${startParam}`;
        }

        if (baseUrl) {
            try {
                const url = new URL(baseUrl);
                url.searchParams.set('startapp', startParam);
                return url.toString();
            } catch (error) {
                return baseUrl;
            }
        }

        return 'https://t.me';
    }

    private normalizeReason(reason: string): string {
        const trimmed = reason.trim();
        if (trimmed.length <= 120) {
            return trimmed;
        }
        return `${trimmed.slice(0, 117)}...`;
    }
}
