import {forwardRef, Inject, Injectable, Logger} from '@nestjs/common';
import {Context} from 'telegraf';
import {DealsService} from './deals.service';
import {DealCreativeType} from './types/deal-creative-type.enum';
import {DealsDeepLinkService} from './deals-deep-link.service';
import {TelegramMessengerService} from '../../telegram/telegram-messenger.service';

const getStartPayload = (context: Context): string | undefined => {
    if (!('startPayload' in context)) {
        return undefined;
    }

    const value = (context as {startPayload?: unknown}).startPayload;
    return typeof value === 'string' ? value : undefined;
};

const getTelegramUserId = (context: Context): string => {
    const fromId = (context as {from?: {id?: number}}).from?.id;
    return String(fromId ?? '');
};

const getChatId = (context: Context): string => {
    const chatId = (context as {chat?: {id?: number}}).chat?.id;
    return String(chatId ?? '');
};

@Injectable()
export class DealsBotHandler {
    private readonly logger = new Logger(DealsBotHandler.name);

    constructor(
        @Inject(forwardRef(() => DealsService))
        private readonly dealsService: DealsService,
        private readonly dealsDeepLinkService: DealsDeepLinkService,
        private readonly telegramMessengerService: TelegramMessengerService,
    ) {}

    async handleStart(context: Context): Promise<boolean> {
        const payload = getStartPayload(context)?.trim();
        if (!payload?.startsWith('deal_')) {
            return false;
        }

        const dealId = payload.replace('deal_', '').trim();
        if (!dealId) {
            await this.telegramMessengerService.sendText(
                getTelegramUserId(context),
                'telegram.errors.invalid_deal_link',
            );
            return true;
        }

        await this.telegramMessengerService.sendText(
            getTelegramUserId(context),
            'telegram.deal.creative_ready',
            {dealId: dealId.slice(0, 8)},
        );
        return true;
    }

    async handleCreativeMessage(context: Context): Promise<boolean> {
        const message = context.message as
            | {
                  text?: string;
                  caption?: string;
                  message_id: number;
                  photo?: Array<{file_id: string; file_unique_id: string}>;
                  video?: {file_id: string; file_unique_id: string};
              }
            | undefined;

        if (!message) {
            await this.telegramMessengerService.sendText(
                getTelegramUserId(context),
                'telegram.deal.creative.unsupported_format',
            );
            return true;
        }

        const telegramUserId = getTelegramUserId(context);
        const messageId = message.message_id;
        const traceId = `${telegramUserId}:${messageId}`;
        const text = message.text ?? null;
        const caption = message.caption ?? null;
        const hasText = Boolean(text);
        const hasPhoto = Boolean(message.photo?.length);
        const hasVideo = Boolean(message.video);
        let type: DealCreativeType | null = null;
        let mediaFileId: string | null = null;
        let replyKey = 'telegram.deal.creative.save_failed';
        let replyArgs: Record<string, any> | undefined;
        let replyMiniAppUrl: string | null = null;

        this.logger.log('DealsBot creative message received', {
            traceId,
            telegramId: telegramUserId,
            messageId,
            hasText,
            hasPhoto,
            hasVideo,
        });

        if (message.photo && message.photo.length > 0) {
            const largest = message.photo[message.photo.length - 1];
            type = DealCreativeType.IMAGE;
            mediaFileId = largest.file_id;
        }
        if (message.video) {
            type = DealCreativeType.VIDEO;
            mediaFileId = message.video.file_id;
        }
        if (!type && text) {
            type = DealCreativeType.TEXT;
        }

        try {
            if (!type) {
                replyKey = 'telegram.deal.creative.unsupported_format';
                this.logger.warn('DealsBot unsupported creative format', {
                    traceId,
                    telegramId: telegramUserId,
                });
            } else if (
                (type === DealCreativeType.IMAGE ||
                    type === DealCreativeType.VIDEO) &&
                !caption
            ) {
                replyKey = 'telegram.deal.creative.missing_caption';
                this.logger.warn('DealsBot creative missing caption', {
                    traceId,
                    telegramId: telegramUserId,
                    type,
                });
            } else {
                const result = await this.dealsService.handleCreativeMessage({
                    traceId,
                    telegramUserId,
                    type,
                    text,
                    caption,
                    mediaFileId,
                    rawPayload: {
                        chatId: getChatId(context),
                        messageId,
                        text,
                        caption,
                        photoFileIds: message.photo?.map((item) => item.file_id),
                        videoFileId: message.video?.file_id,
                    },
                });

                replyKey = result.messageKey;
                replyArgs = result.messageArgs;

                if (result.success && result.dealId) {
                    replyMiniAppUrl = this.dealsDeepLinkService.buildDealLink(
                        result.dealId,
                    );
                }
            }
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            this.logger.error('DealsBot creative handling failed', {
                traceId,
                telegramId: telegramUserId,
                errorMessage,
                stack: error instanceof Error ? error.stack : undefined,
            });
        }

        if (replyMiniAppUrl) {
            await this.telegramMessengerService.sendInlineKeyboard(
                telegramUserId,
                replyKey,
                replyArgs,
                [[{textKey: 'telegram.common.open_mini_app', url: replyMiniAppUrl}]],
            );
            return true;
        }

        await this.telegramMessengerService.sendText(
            telegramUserId,
            replyKey,
            replyArgs,
        );

        return true;
    }

    async handleCreativeApproveCallback(
        context: Context,
        dealId: string,
    ): Promise<boolean> {
        const result = await this.dealsService.handleCreativeApprovalFromTelegram({
            telegramUserId: getTelegramUserId(context),
            dealId,
        });

        if (!result.handled) {
            return false;
        }

        await context.answerCbQuery();
        if (result.messageKey) {
            await this.telegramMessengerService.sendText(
                getTelegramUserId(context),
                result.messageKey,
                result.messageArgs,
            );
        }

        return true;
    }

    async handleCreativeRequestChangesCallback(
        context: Context,
        dealId: string,
    ): Promise<boolean> {
        const result =
            await this.dealsService.handleCreativeRequestChangesFromTelegram({
                telegramUserId: getTelegramUserId(context),
                dealId,
            });

        if (!result.handled) {
            return false;
        }

        await context.answerCbQuery();
        if (result.messageKey) {
            await this.telegramMessengerService.sendText(
                getTelegramUserId(context),
                result.messageKey,
                result.messageArgs,
            );
        }

        return true;
    }

    async handleCreativeRejectCallback(
        context: Context,
        dealId: string,
    ): Promise<boolean> {
        const result = await this.dealsService.handleCreativeRejectFromTelegram({
            telegramUserId: getTelegramUserId(context),
            dealId,
        });

        if (!result.handled) {
            return false;
        }

        await context.answerCbQuery();
        if (result.messageKey) {
            await this.telegramMessengerService.sendText(
                getTelegramUserId(context),
                result.messageKey,
                result.messageArgs,
            );
        }

        return true;
    }
}
