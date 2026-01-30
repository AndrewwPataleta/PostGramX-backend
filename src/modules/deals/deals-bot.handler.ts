import {forwardRef, Inject, Injectable} from '@nestjs/common';
import {Context} from 'telegraf';
import {DealsService} from './deals.service';
import {DealCreativeType} from './types/deal-creative-type.enum';

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
            return false;
        }

        const text = message.text ?? null;
        const caption = message.caption ?? null;
        let type: DealCreativeType | null = null;
        let mediaFileId: string | null = null;

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

        const result = await this.dealsService.handleCreativeMessage({
            telegramUserId: getTelegramUserId(context),
            type,
            text,
            caption,
            mediaFileId,
            rawPayload: {
                chatId: getChatId(context),
                message,
            },
        });

        if (!result.handled) {
            return false;
        }

        if (result.message) {
            await context.reply(result.message);
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
}
