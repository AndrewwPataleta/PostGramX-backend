import {forwardRef, Inject, Injectable, Logger} from '@nestjs/common';
import {Context} from 'telegraf';
import {DealsService} from './deals.service';
import {DealCreativeType} from './types/deal-creative-type.enum';
import {DealsDeepLinkService} from './deals-deep-link.service';
import {buildMiniAppUrl} from '../../telegram/bot/utils/miniapp-links';
import {I18nService} from 'nestjs-i18n';
import {buildBilingualMessage} from '../../common/i18n/bilingual-message';

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

const getActionMessageId = (context: Context): string | undefined => {
    const messageId = (context.callbackQuery as {message?: {message_id?: number}})
        ?.message?.message_id;
    return messageId ? String(messageId) : undefined;
};

const getActionChatId = (context: Context): string | undefined => {
    const chatId = (context.callbackQuery as {message?: {chat?: {id?: number}}})
        ?.message?.chat?.id;
    return chatId ? String(chatId) : undefined;
};

const formatActorLabel = (context: Context): string => {
    const from = (context as {from?: {id?: number; username?: string; first_name?: string; last_name?: string}}).from;
    if (!from) {
        return 'Unknown';
    }
    if (from.username) {
        return `@${from.username}`;
    }
    const name = [from.first_name, from.last_name].filter(Boolean).join(' ');
    return name || `User ${from.id ?? ''}`.trim();
};

@Injectable()
export class DealsBotHandler {
    private readonly logger = new Logger(DealsBotHandler.name);

    constructor(
        @Inject(forwardRef(() => DealsService))
        private readonly dealsService: DealsService,
        private readonly dealsDeepLinkService: DealsDeepLinkService,
        private readonly i18n: I18nService,
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
        let replyOptions:
            | {
                  reply_markup?: {
                      inline_keyboard: Array<Array<{text: string; url: string}>>;
                  };
              }
            | undefined;

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
                    const link = buildMiniAppUrl(
                        this.dealsDeepLinkService.buildDealLink(result.dealId),
                    );
                    if (link) {
                        replyOptions = {
                            reply_markup: {
                                inline_keyboard: [
                                    [{text: 'Open Mini App', url: link}],
                                ],
                            },
                        };
                    } else {
                        this.logger.warn(
                            `Skipping Mini App button: invalid URL for deal ${result.dealId}`,
                        );
                    }
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
            actionMessageId: getActionMessageId(context),
            actionChatId: getActionChatId(context),
        });

        if (!result.handled) {
            return false;
        }

        if (result.action === 'unavailable') {
            const unavailableMessage = await buildBilingualMessage(
                this.i18n,
                'telegram.deals.action_unavailable',
            );
            await context.answerCbQuery(unavailableMessage);
            return true;
        }

        await context.answerCbQuery();
        if (result.messageKey) {
            const replyMessage = await buildBilingualMessage(
                this.i18n,
                result.messageKey,
            );
            await context.reply(replyMessage);
        }

        const finalText = await buildBilingualMessage(
            this.i18n,
            'telegram.deals.review_locked.approved',
            {args: {actor: formatActorLabel(context)}},
        );
        await this.lockReviewMessage(context, finalText);

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
                actionMessageId: getActionMessageId(context),
                actionChatId: getActionChatId(context),
            });

        if (!result.handled) {
            return false;
        }

        if (result.action === 'unavailable') {
            const unavailableMessage = await buildBilingualMessage(
                this.i18n,
                'telegram.deals.action_unavailable',
            );
            await context.answerCbQuery(unavailableMessage);
            return true;
        }

        await context.answerCbQuery();
        if (result.messageKey) {
            const replyMessage = await buildBilingualMessage(
                this.i18n,
                result.messageKey,
            );
            await context.reply(replyMessage);
        }

        this.logger.log('[BOT] request_changes', {
            dealId,
            actorTelegramId: getTelegramUserId(context),
            reviewMessageId: getActionMessageId(context),
        });

        const finalText = await buildBilingualMessage(
            this.i18n,
            'telegram.deals.review_locked.changes_pending',
            {args: {actor: formatActorLabel(context)}},
        );
        await this.lockReviewMessage(context, finalText);

        const instructionText = await buildBilingualMessage(
            this.i18n,
            'telegram.deals.request_changes_prompt',
        );
        const instructionMessage = await context.reply(instructionText);
        await this.dealsService.storeAdminReviewReplyMessageId(
            dealId,
            String(instructionMessage.message_id),
        );

        return true;
    }

    async handleCreativeRejectCallback(
        context: Context,
        dealId: string,
    ): Promise<boolean> {
        const result = await this.dealsService.handleCreativeRejectFromTelegram({
            telegramUserId: getTelegramUserId(context),
            dealId,
            actionMessageId: getActionMessageId(context),
            actionChatId: getActionChatId(context),
        });

        if (!result.handled) {
            return false;
        }

        if (result.action === 'unavailable') {
            const unavailableMessage = await buildBilingualMessage(
                this.i18n,
                'telegram.deals.action_unavailable',
            );
            await context.answerCbQuery(unavailableMessage);
            return true;
        }

        await context.answerCbQuery();
        if (result.messageKey) {
            const replyMessage = await buildBilingualMessage(
                this.i18n,
                result.messageKey,
            );
            await context.reply(replyMessage);
        }

        const finalText = await buildBilingualMessage(
            this.i18n,
            'telegram.deals.review_locked.rejected',
            {args: {actor: formatActorLabel(context)}},
        );
        await this.lockReviewMessage(context, finalText);

        return true;
    }

    async handleAdminReviewReply(context: Context): Promise<boolean> {
        const message = context.message as
            | {
                  text?: string;
                  caption?: string;
                  message_id?: number;
                  reply_to_message?: {message_id?: number};
              }
            | undefined;
        const replyToMessageId = message?.reply_to_message?.message_id;
        if (!replyToMessageId) {
            return false;
        }

        const replyText = message?.text ?? message?.caption ?? '';
        const result = await this.dealsService.handleCreativeRequestChangesNotesFromTelegram(
            {
                telegramUserId: getTelegramUserId(context),
                replyMessageId: String(replyToMessageId),
                text: replyText,
            },
        );

        if (!result.handled) {
            return true;
        }

        if (result.messageKey) {
            const replyMessage = await buildBilingualMessage(
                this.i18n,
                result.messageKey,
            );
            await context.reply(replyMessage);
        }

        return true;
    }

    private async lockReviewMessage(
        context: Context,
        finalText: string,
    ): Promise<void> {
        const message = context.callbackQuery as
            | {
                  message?: {
                      message_id?: number;
                      chat?: {id?: number};
                      text?: string;
                      caption?: string;
                  };
              }
            | undefined;
        const messageId = message?.message?.message_id;
        const chatId = message?.message?.chat?.id;
        if (!messageId || !chatId) {
            return;
        }

        try {
            if (message?.message?.text) {
                await context.telegram.editMessageText(
                    chatId,
                    messageId,
                    undefined,
                    finalText,
                    {reply_markup: {inline_keyboard: []}},
                );
                return;
            }

            if (message?.message?.caption) {
                await context.telegram.editMessageCaption(
                    chatId,
                    messageId,
                    undefined,
                    finalText,
                    {reply_markup: {inline_keyboard: []}},
                );
                return;
            }

            await context.telegram.editMessageReplyMarkup(chatId, messageId, {
                inline_keyboard: [],
            });
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            this.logger.warn('[BOT] editMessage failed', {
                errorMessage,
                chatId,
                messageId,
            });
        }
    }
}
