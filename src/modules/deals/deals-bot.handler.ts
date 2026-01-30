import {forwardRef, Inject, Injectable, Logger} from '@nestjs/common';
import {Context} from 'telegraf';
import {DealsService} from './deals.service';
import {DealCreativeType} from './types/deal-creative-type.enum';
import {DealsDeepLinkService} from './deals-deep-link.service';

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
    ) {}

    async handleStart(context: Context): Promise<boolean> {
        const payload = getStartPayload(context)?.trim();
        if (!payload?.startsWith('deal_')) {
            return false;
        }

        const dealId = payload.replace('deal_', '').trim();
        if (!dealId) {
            await context.reply('Invalid deal link.');
            return true;
        }

        await context.reply(
            `Ready to receive creative for deal ${dealId.slice(0, 8)}.\n` +
                'Please send the post content to this bot.',
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
            await context.reply(
                '⚠️ Unsupported format.\nSend: text, photo+caption, or video+caption.',
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
        let replyMessage =
            '❌ Failed to save creative due to a server error.\nPlease try again in 1 minute. If it persists, re-open the Mini App and re-schedule.';
        let replyOptions: {
            reply_markup?: {inline_keyboard: Array<Array<{text: string; url: string}>>};
        } | undefined;

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
                replyMessage =
                    '⚠️ Unsupported format.\nSend: text, photo+caption, or video+caption.';
                this.logger.warn('DealsBot unsupported creative format', {
                    traceId,
                    telegramId: telegramUserId,
                });
            } else if (
                (type === DealCreativeType.IMAGE ||
                    type === DealCreativeType.VIDEO) &&
                !caption
            ) {
                replyMessage =
                    '⚠️ Please add a caption (text) to your media, or send text separately.';
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

                replyMessage =
                    result.message ??
                    '⚠️ I can’t process your creative right now. Please try again.';

                if (result.success && result.dealId) {
                    const link = this.dealsDeepLinkService.buildDealLink(
                        result.dealId,
                    );
                    replyOptions = {
                        reply_markup: {
                            inline_keyboard: [
                                [{text: 'Open Mini App', url: link}],
                            ],
                        },
                    };
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
        } finally {
            await context.reply(replyMessage, replyOptions);
        }

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
        if (result.message) {
            await context.reply(result.message);
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
        if (result.message) {
            await context.reply(result.message);
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
        if (result.message) {
            await context.reply(result.message);
        }

        return true;
    }
}
