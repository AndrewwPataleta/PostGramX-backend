import {Injectable} from '@nestjs/common';
import {Context, Markup} from 'telegraf';
import {PreDealsService} from './predeals.service';

const CALLBACK_CONFIRM = 'predeal_confirm';
const CALLBACK_RESEND = 'predeal_resend';
const CALLBACK_CANCEL = 'predeal_cancel';
const CALLBACK_APPROVE = 'predeal_approve';
const CALLBACK_REJECT = 'predeal_reject';
const CALLBACK_PAYMENT_WINDOW = 'predeal_payment_window';

@Injectable()
export class PreDealsBotHandler {
    constructor(private readonly preDealsService: PreDealsService) {}

    async handleStart(context: Context): Promise<boolean> {
        if (!('startPayload' in context)) {
            return false;
        }

        const payload = context.startPayload?.trim();
        if (!payload?.startsWith('predeal_')) {
            return false;
        }

        const preDealId = payload.replace('predeal_', '').trim();
        if (!preDealId) {
            await context.reply('Invalid pre-deal link.');
            return true;
        }

        const telegramUserId = String(context.from?.id ?? '');
        const chatId = String(context.chat?.id ?? '');
        const result = await this.preDealsService.handleBotStart(
            telegramUserId,
            chatId,
            preDealId,
        );

        await context.reply(result.message);
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
                  document?: {file_id: string; file_unique_id: string};
                  animation?: {file_id: string; file_unique_id: string};
                  audio?: {file_id: string; file_unique_id: string};
              }
            | undefined;

        if (!message) {
            return false;
        }

        const attachments: Array<Record<string, unknown>> = [];
        if (message.photo && message.photo.length > 0) {
            const largest = message.photo[message.photo.length - 1];
            attachments.push({type: 'photo', fileId: largest.file_id});
        }
        if (message.video) {
            attachments.push({type: 'video', fileId: message.video.file_id});
        }
        if (message.document) {
            attachments.push({type: 'document', fileId: message.document.file_id});
        }
        if (message.animation) {
            attachments.push({type: 'animation', fileId: message.animation.file_id});
        }
        if (message.audio) {
            attachments.push({type: 'audio', fileId: message.audio.file_id});
        }

        const result = await this.preDealsService.handleCreativeMessage({
            telegramUserId: String(context.from?.id ?? ''),
            chatId: String(context.chat?.id ?? ''),
            messageId: message.message_id,
            text: message.text ?? message.caption ?? null,
            attachments: attachments.length > 0 ? attachments : null,
        });

        if (!result.handled) {
            return false;
        }

        if (result.message) {
            const keyboard = result.preDealId
                ? Markup.inlineKeyboard([
                      [
                          Markup.button.callback(
                              '✅ Confirm',
                              `${CALLBACK_CONFIRM}:${result.preDealId}`,
                          ),
                          Markup.button.callback(
                              '✏️ Send another',
                              `${CALLBACK_RESEND}:${result.preDealId}`,
                          ),
                      ],
                      [
                          Markup.button.callback(
                              '❌ Cancel',
                              `${CALLBACK_CANCEL}:${result.preDealId}`,
                          ),
                      ],
                  ])
                : undefined;

            await context.reply(result.message, keyboard);
        }

        return true;
    }

    async handleCallback(context: Context): Promise<boolean> {
        const callbackQuery = context.callbackQuery;
        const data =
            callbackQuery && 'data' in callbackQuery
                ? callbackQuery.data
                : undefined;

        if (!data) {
            return false;
        }

        const [action, preDealId, payload] = data.split(':');
        if (!action || !preDealId) {
            return false;
        }

        const telegramUserId = String(context.from?.id ?? '');

        if (action === CALLBACK_CONFIRM) {
            const result = await this.preDealsService.handleAdvertiserConfirm(
                telegramUserId,
                preDealId,
            );
            await context.answerCbQuery();
            await context.reply(result.message);
            return true;
        }

        if (action === CALLBACK_RESEND) {
            const result = await this.preDealsService.handleAdvertiserResend(
                telegramUserId,
                preDealId,
            );
            await context.answerCbQuery();
            await context.reply(result.message);
            return true;
        }

        if (action === CALLBACK_CANCEL) {
            const result = await this.preDealsService.handleAdvertiserCancel(
                telegramUserId,
                preDealId,
            );
            await context.answerCbQuery();
            await context.reply(result.message);
            return true;
        }

        if (action === CALLBACK_APPROVE) {
            const result = await this.preDealsService.handlePublisherApprove(
                telegramUserId,
                preDealId,
            );
            await context.answerCbQuery();
            if (result.requestPaymentWindow) {
                const keyboard = Markup.inlineKeyboard([
                    [
                        Markup.button.callback(
                            '1 hour',
                            `${CALLBACK_PAYMENT_WINDOW}:${preDealId}:3600`,
                        ),
                        Markup.button.callback(
                            '2 hours',
                            `${CALLBACK_PAYMENT_WINDOW}:${preDealId}:7200`,
                        ),
                    ],
                    [
                        Markup.button.callback(
                            '1 day',
                            `${CALLBACK_PAYMENT_WINDOW}:${preDealId}:86400`,
                        ),
                    ],
                ]);
                await context.reply(result.message, keyboard);
            } else {
                await context.reply(result.message);
            }
            return true;
        }

        if (action === CALLBACK_REJECT) {
            const result = await this.preDealsService.handlePublisherReject(
                telegramUserId,
                preDealId,
            );
            await context.answerCbQuery();
            await context.reply(result.message);
            return true;
        }

        if (action === CALLBACK_PAYMENT_WINDOW) {
            const windowSeconds = payload ? Number(payload) : NaN;
            if (!Number.isFinite(windowSeconds) || windowSeconds <= 0) {
                await context.answerCbQuery();
                await context.reply('Invalid payment window.');
                return true;
            }

            const result = await this.preDealsService.handlePaymentWindowSelection(
                telegramUserId,
                preDealId,
                windowSeconds,
            );
            await context.answerCbQuery();
            await context.reply(result.message);
            return true;
        }

        return false;
    }
}
