import {forwardRef, Inject, Injectable, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {DealEntity} from './entities/deal.entity';
import {DealCreativeEntity} from './entities/deal-creative.entity';
import {DealEscrowEntity} from './entities/deal-escrow.entity';
import {ChannelEntity} from '../channels/entities/channel.entity';
import {ChannelParticipantsService} from '../channels/channel-participants.service';
import {DealsDeepLinkService} from './deals-deep-link.service';

import {User} from '../auth/entities/user.entity';
import {buildMiniAppDealLink} from '../telegram/bot/utils/miniapp-links';
import {formatTon} from '../payments/utils/bigint';
import {CurrencyCode} from '../../common/constants/currency/currency.constants';
import {TelegramI18nService} from "../telegram/i18n/telegram-i18n.service";
import {TelegramInlineButtonSpec, TelegramMessengerService} from "../telegram/telegram-messenger.service";

const NOTIFICATION_CONCURRENCY = 5;

type DealActionReason = 'verification' | 'approval' | 'payment' | 'publish';

@Injectable()
export class DealsNotificationsService {
    private readonly logger = new Logger(DealsNotificationsService.name);

    constructor(
        @InjectRepository(ChannelEntity)
        private readonly channelRepository: Repository<ChannelEntity>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly participantsService: ChannelParticipantsService,
        private readonly deepLinkService: DealsDeepLinkService,
        private readonly telegramI18nService: TelegramI18nService,
        @Inject(forwardRef(() => TelegramMessengerService))
        private readonly telegramMessengerService: TelegramMessengerService,
    ) {
    }

    async notifyCreativeRequired(
        deal: DealEntity,
        advertiserTelegramId: string,
    ): Promise<void> {
        const link = this.deepLinkService.buildDealLink(deal.id);
        await this.telegramMessengerService.sendInlineKeyboard(
            advertiserTelegramId,
            'telegram.deal.creative_required.message',
            undefined,
            [[{textKey: 'telegram.common.open_mini_app', url: link}]],
        );
    }

    async notifyCreativeSubmitted(
        deal: DealEntity,
        creative: DealCreativeEntity,
    ): Promise<void> {
        if (!deal.channelId) {
            this.logger.warn(
                `Skipping creative notification: missing channelId for deal ${deal.id}`,
            );
            return;
        }

        const channel = await this.channelRepository.findOne({
            where: {id: deal.channelId},
        });
        if (!channel) {
            this.logger.warn(
                `Skipping creative notification: channel not found for deal ${deal.id}`,
            );
            return;
        }

        const recipients =
            await this.participantsService.getNotificationRecipients(
                deal.channelId,
            );
        if (recipients.length === 0) {
            this.logger.log(
                `No recipients found for creative notification: dealId=${deal.id} channelId=${deal.channelId}`,
            );
            return;
        }

        const scheduledAtValue = deal.scheduledAt
            ? this.formatUtcTimestamp(deal.scheduledAt)
            : null;
        const channelLabel = channel.username
            ? `@${channel.username}`
            : channel.title;

        const link = this.deepLinkService.buildDealLink(deal.id);
        const buttons: TelegramInlineButtonSpec[][] = [
            [
                {
                    textKey: 'telegram.deal.buttons.approve',
                    callbackData: `approve_creative:${deal.id}`,
                },
            ],
            [
                {
                    textKey: 'telegram.deal.buttons.request_changes',
                    callbackData: `request_changes:${deal.id}`,
                },
            ],
            [
                {
                    textKey: 'telegram.deal.buttons.reject',
                    callbackData: `reject_creative:${deal.id}`,
                },
            ],
        ];
        const payload = (creative.payload ?? {}) as Record<string, unknown>;
        const creativeText = String(payload.text ?? payload.caption ?? '');
        const textContent = this.truncateText(creativeText, 500);
        const creativeType = String(payload.type ?? 'TEXT');
        const mediaFileId = payload.mediaFileId as string | undefined;

        await this.runWithConcurrency(
            recipients,
            NOTIFICATION_CONCURRENCY,
            async (recipient) => {
                try {
                    const lang =
                        this.telegramI18nService.resolveLanguageForUser(recipient);
                    const scheduledAt =
                        scheduledAtValue ??
                        this.telegramI18nService.t(
                            lang,
                            'telegram.common.tbd',
                        );
                    const messageArgs = {
                        channel: channelLabel,
                        dealId: deal.id.slice(0, 8),
                        scheduledAt,
                        creativeText: textContent,
                    };
                    console.log(messageArgs)
                    if (creativeType === 'TEXT') {
                        await this.telegramMessengerService.sendInlineKeyboard(
                            recipient.telegramId as string,
                            'telegram.deal.creative_submitted.message',
                            messageArgs,
                            buttons,
                            {lang},
                        );
                    } else if (creativeType === 'IMAGE' && mediaFileId) {
                        await this.telegramMessengerService.sendPhotoWithCaption(
                            recipient.telegramId as string,
                            mediaFileId,
                            'telegram.deal.creative_submitted.message',
                            messageArgs,
                            {lang, buttons},
                        );
                    } else if (creativeType === 'VIDEO' && mediaFileId) {
                        await this.telegramMessengerService.sendVideoWithCaption(
                            recipient.telegramId as string,
                            mediaFileId,
                            'telegram.deal.creative_submitted.message',
                            messageArgs,
                            {lang, buttons},
                        );
                    } else {
                        await this.telegramMessengerService.sendInlineKeyboard(
                            recipient.telegramId as string,
                            'telegram.deal.creative_submitted.unsupported_preview',
                            {
                                channel: channelLabel,
                                dealId: deal.id.slice(0, 8),
                                scheduledAt,
                            },
                            buttons,
                            {lang},
                        );
                    }

                } catch (error) {
                    const errorMessage =
                        error instanceof Error ? error.message : String(error);
                    this.logger.warn(
                        `Failed to send creative notification: dealId=${deal.id} recipient=${recipient.id} error=${errorMessage}`,
                    );
                }
            },
        );
    }

    async notifyAdvertiser(
        deal: DealEntity,
        messageKey: string,
        messageArgs?: Record<string, any>,
    ): Promise<void> {
        const user = await this.userRepository.findOne({
            where: {id: deal.advertiserUserId},
        });
        if (!user?.telegramId) {
            return;
        }
        await this.telegramMessengerService.sendText(
            user.telegramId,
            messageKey,
            messageArgs,
            {lang: this.telegramI18nService.resolveLanguageForUser(user)},
        );
    }

    async notifyAdvertiserPaymentRequired(
        deal: DealEntity,
        escrow: DealEscrowEntity,
    ): Promise<void> {
        const user = await this.userRepository.findOne({
            where: {id: deal.advertiserUserId},
        });
        if (!user?.telegramId) {
            return;
        }

        const paymentDeadline = escrow.paymentDeadlineAt;
        const paymentAddress = escrow.paymentAddress;
        const dealShortId = deal.id.slice(0, 8);
        const messageKey = this.resolvePaymentRequiredKey(
            Boolean(paymentDeadline),
            Boolean(paymentAddress),
        );
        const messageArgs = {
            dealId: dealShortId,
            paymentDeadline: paymentDeadline?.toISOString(),
            paymentAddress,
        };

        const link = this.ensureMiniAppLink(deal.id);
        const buttons: TelegramInlineButtonSpec[][] = link
            ? [
                [
                    {
                        textKey: 'telegram.common.pay_in_app',
                        webAppUrl: link,
                    },
                ],
                [
                    {
                        textKey: 'telegram.common.open_mini_app',
                        url: link,
                    },
                ],
            ]
            : [];

        if (buttons.length) {
            await this.telegramMessengerService.sendInlineKeyboard(
                user.telegramId,
                messageKey,
                messageArgs,
                buttons,
                {lang: this.telegramI18nService.resolveLanguageForUser(user)},
            );
        } else {
            await this.telegramMessengerService.sendText(
                user.telegramId,
                messageKey,
                messageArgs,
                {lang: this.telegramI18nService.resolveLanguageForUser(user)},
            );
        }

        this.logger.log('Sent pay-in-app button to advertiser', {
            dealId: deal.id,
            advertiserTelegramId: user.telegramId,
            url: link,
        });
    }

    async notifyAdvertiserPartialPayment(
        deal: DealEntity,
        receivedNano: string,
        remainingNano: string,
    ): Promise<void> {
        const user = await this.userRepository.findOne({
            where: {id: deal.advertiserUserId},
        });
        if (!user?.telegramId) {
            return;
        }

        const link = this.ensureMiniAppLink(deal.id);
        const messageArgs = {
            dealId: deal.id.slice(0, 8),
            received: formatTon(receivedNano),
            remaining: formatTon(remainingNano),
            currency: CurrencyCode.TON,
        };
        const buttons: TelegramInlineButtonSpec[][] = link
            ? [
                [
                    {
                        textKey: 'telegram.common.pay_in_app',
                        webAppUrl: link,
                    },
                ],
                [
                    {
                        textKey: 'telegram.common.open_mini_app',
                        url: link,
                    },
                ],
            ]
            : [];

        if (buttons.length) {
            await this.telegramMessengerService.sendInlineKeyboard(
                user.telegramId,
                'telegram.deal.partial_payment.message',
                messageArgs,
                buttons,
                {lang: this.telegramI18nService.resolveLanguageForUser(user)},
            );
        } else {
            await this.telegramMessengerService.sendText(
                user.telegramId,
                'telegram.deal.partial_payment.message',
                messageArgs,
                {lang: this.telegramI18nService.resolveLanguageForUser(user)},
            );
        }
    }

    async notifyPaymentConfirmed(deal: DealEntity): Promise<void> {
        const advertiser = await this.userRepository.findOne({
            where: {id: deal.advertiserUserId},
        });

        const link = this.ensureMiniAppLink(deal.id);
        const buttons: TelegramInlineButtonSpec[][] = link
            ? [[{textKey: 'telegram.common.open_mini_app', url: link}]]
            : [];

        if (advertiser?.telegramId) {
            if (buttons.length) {
                await this.telegramMessengerService.sendInlineKeyboard(
                    advertiser.telegramId,
                    'telegram.deal.payment_confirmed.message',
                    {dealId: deal.id.slice(0, 8)},
                    buttons,
                    {
                        lang: this.telegramI18nService.resolveLanguageForUser(advertiser),
                    },
                );
            } else {
                await this.telegramMessengerService.sendText(
                    advertiser.telegramId,
                    'telegram.deal.payment_confirmed.message',
                    {dealId: deal.id.slice(0, 8)},
                    {
                        lang: this.telegramI18nService.resolveLanguageForUser(advertiser),
                    },
                );
            }
        }

        const recipients =
            await this.participantsService.getNotificationRecipients(
                deal.channelId,
            );
        await this.runWithConcurrency(
            recipients,
            NOTIFICATION_CONCURRENCY,
            async (recipient) => {
                if (!recipient.telegramId) {
                    return;
                }
                if (buttons.length) {
                    await this.telegramMessengerService.sendInlineKeyboard(
                        recipient.telegramId,
                        'telegram.deal.payment_confirmed.message',
                        {dealId: deal.id.slice(0, 8)},
                        buttons,
                        {
                            lang: this.telegramI18nService.resolveLanguageForUser(
                                recipient,
                            ),
                        },
                    );
                } else {
                    await this.telegramMessengerService.sendText(
                        recipient.telegramId,
                        'telegram.deal.payment_confirmed.message',
                        {dealId: deal.id.slice(0, 8)},
                        {
                            lang: this.telegramI18nService.resolveLanguageForUser(
                                recipient,
                            ),
                        },
                    );
                }
            },
        );
    }

    async notifyDealCreated(deal: DealEntity): Promise<void> {
        await this.notifyDeal(deal, {
            type: 'DEAL_CREATED',
            messageKey: 'telegram.deal.notification.created',
        });
    }

    async notifyDealActionRequired(
        deal: DealEntity,
        reason: DealActionReason,
    ): Promise<void> {
        await this.notifyDeal(deal, {
            type: 'ACTION_REQUIRED',
            messageKey: 'telegram.deal.notification.action_required',
            reasonKey: this.mapReasonKey(reason),
        });
    }

    private async notifyDeal(
        deal: DealEntity,
        payload: { type: string; messageKey: string; reasonKey?: string },
    ): Promise<void> {
        if (!deal.channelId) {
            this.logger.warn(
                `Skipping deal notification: missing channelId for deal ${deal.id}`,
            );
            return;
        }

        const channel = await this.channelRepository.findOne({
            where: {id: deal.channelId},
        });

        if (!channel) {
            this.logger.warn(
                `Skipping deal notification: channel not found for deal ${deal.id}`,
            );
            return;
        }

        const recipients = await this.participantsService.getNotificationRecipients(
            deal.channelId,
        );
        if (recipients.length === 0) {
            this.logger.log(
                `No recipients found for deal notification: dealId=${deal.id} channelId=${deal.channelId}`,
            );
            return;
        }

        const link = this.deepLinkService.buildDealLink(deal.id);
        const buttons: TelegramInlineButtonSpec[][] = [
            [{textKey: 'telegram.common.open_deal', url: link}],
        ];

        this.logger.log(
            `Sending deal notification ${payload.type}: dealId=${deal.id} channelId=${deal.channelId} recipients=${recipients.length}`,
        );

        await this.runWithConcurrency(
            recipients,
            NOTIFICATION_CONCURRENCY,
            async (recipient) => {
                try {
                    if (!recipient.telegramId) {
                        return;
                    }
                    const lang =
                        this.telegramI18nService.resolveLanguageForUser(recipient);
                    const channelLabel = channel.username
                        ? `${channel.title} (@${channel.username})`
                        : channel.title;
                    const args: Record<string, any> = {
                        channel: channelLabel,
                        dealId: deal.id.slice(0, 8),
                        status: deal.status ?? 'unknown',
                        stage: deal.stage ?? 'unknown',
                    };
                    if (payload.reasonKey) {
                        args.reason = this.telegramI18nService.t(
                            lang,
                            payload.reasonKey,
                        );
                    }
                    await this.telegramMessengerService.sendInlineKeyboard(
                        recipient.telegramId,
                        payload.messageKey,
                        args,
                        buttons,
                        {lang},
                    );
                } catch (error) {
                    const errorMessage =
                        error instanceof Error ? error.message : String(error);
                    this.logger.warn(
                        `Failed to send deal notification: dealId=${deal.id} recipient=${recipient.id} error=${errorMessage}`,
                    );
                }
            },
        );
    }

    private formatUtcTimestamp(value: Date): string {
        return value
            .toISOString()
            .replace('T', ' ')
            .replace(/\.\d{3}Z$/, ' UTC');
    }

    private resolvePaymentRequiredKey(
        hasDeadline: boolean,
        hasAddress: boolean,
    ): string {
        if (hasDeadline && hasAddress) {
            return 'telegram.deal.payment_required.with_deadline_and_address';
        }
        if (hasDeadline) {
            return 'telegram.deal.payment_required.with_deadline';
        }
        if (hasAddress) {
            return 'telegram.deal.payment_required.with_address';
        }
        return 'telegram.deal.payment_required.basic';
    }

    private mapReasonKey(reason: DealActionReason): string {
        switch (reason) {
            case 'verification':
                return 'telegram.deal.action_reason.verification';
            case 'approval':
                return 'telegram.deal.action_reason.approval';
            case 'payment':
                return 'telegram.deal.action_reason.payment';
            case 'publish':
                return 'telegram.deal.action_reason.publish';
            default:
                return 'telegram.deal.action_reason.generic';
        }
    }

    private ensureMiniAppLink(dealId: string): string | null {
        const link = buildMiniAppDealLink(dealId);
        try {
            const url = new URL(link);
            if (url.protocol !== 'https:') {
                this.logger.warn(
                    `Invalid Mini App URL protocol for deal ${dealId}`,
                );
                return null;
            }
            return link;
        } catch (error) {
            this.logger.warn(`Invalid Mini App URL for deal ${dealId}`);
            return null;
        }
    }

    private truncateText(value: string, limit: number): string {
        if (value.length <= limit) {
            return value;
        }
        return `${value.slice(0, Math.max(limit - 3, 0))}...`;
    }

    private async runWithConcurrency<T>(
        items: T[],
        limit: number,
        task: (item: T) => Promise<void>,
    ): Promise<void> {
        const queue = [...items];
        const workerCount = Math.min(limit, queue.length);

        const workers = Array.from({length: workerCount}, async () => {
            while (queue.length > 0) {
                const item = queue.shift();
                if (!item) {
                    return;
                }
                await task(item);
            }
        });

        await Promise.all(workers);
    }
}
