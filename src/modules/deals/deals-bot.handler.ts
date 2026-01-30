import {forwardRef, Inject, Injectable} from '@nestjs/common';
import {Context} from 'telegraf';
import {DealsService} from './deals.service';

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

const extractDealId = (text: string): string | null => {
    const commandMatch = text.match(/\/deal\s+([0-9a-fA-F-]{36})/);
    if (commandMatch?.[1]) {
        return commandMatch[1];
    }

    const tokenMatch = text.match(/\bdeal[_: ]([0-9a-fA-F-]{36})\b/);
    return tokenMatch?.[1] ?? null;
};

@Injectable()
export class DealsBotHandler {
    constructor(
        @Inject(forwardRef(() => DealsService))
        private readonly dealsService: DealsService,
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
                `Please send the post here and include "/deal ${dealId}" in the message or caption.`,
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
                  document?: {file_id: string; file_unique_id: string};
                  animation?: {file_id: string; file_unique_id: string};
                  audio?: {file_id: string; file_unique_id: string};
              }
            | undefined;

        if (!message) {
            return false;
        }

        const text = message.text ?? message.caption ?? '';
        const dealId = extractDealId(text);
        if (!dealId) {
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

        const result = await this.dealsService.handleCreativeMessage({
            telegramUserId: getTelegramUserId(context),
            chatId: getChatId(context),
            dealId,
            messageId: String(message.message_id),
            text: text || null,
            attachments: attachments.length > 0 ? attachments : null,
        });

        if (!result.handled) {
            return false;
        }

        if (result.message) {
            await context.reply(result.message);
        }

        return true;
    }
}
