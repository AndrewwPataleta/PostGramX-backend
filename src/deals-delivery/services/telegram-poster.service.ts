import {Injectable, Logger} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {DealCreativeEntity} from '../../modules/deals/entities/deal-creative.entity';
import {DealCreativeType} from '../../modules/deals/types/deal-creative-type.enum';
import {DealEntity} from '../../modules/deals/entities/deal.entity';
import {ChannelEntity} from '../../modules/channels/entities/channel.entity';
import {
    TelegramChatService,
    TelegramChatServiceError,
} from '../../modules/telegram/telegram-chat.service';
import {DeliveryCheckResult} from '../types/delivery-check-result';

interface TelegramMessageResponse {
    message_id: number;
}

interface TelegramApiResponse<T> {
    ok: boolean;
    result?: T;
    description?: string;
    error_code?: number;
}

@Injectable()
export class TelegramPosterService {
    private readonly logger = new Logger(TelegramPosterService.name);
    private readonly apiBaseUrl: string;

    constructor(
        private readonly configService: ConfigService,
        private readonly telegramChatService: TelegramChatService,
    ) {
        const token = this.configService.get<string>('BOT_TOKEN');
        if (!token) {
            throw new Error('BOT_TOKEN is required for TelegramPosterService');
        }
        const baseUrl = this.configService.get<string>(
            'TELEGRAM_BOT_API_BASE_URL',
        );
        this.apiBaseUrl = baseUrl ?? `https://api.telegram.org/bot${token}`;
    }

    async checkCanPost(channel: ChannelEntity): Promise<DeliveryCheckResult> {
        const chatId = this.resolveChatId(channel);
        if (!chatId) {
            return {ok: false, reason: 'CHANNEL_MISSING_CHAT_ID'};
        }

        try {
            const admins = channel.telegramChatId
                ? await this.telegramChatService.getChatAdministrators(
                      channel.telegramChatId,
                  )
                : await this.telegramChatService.getChatAdministratorsByUsername(
                      channel.username,
                  );
            await this.telegramChatService.extractBotAdmin(admins);
            return {ok: true};
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (error instanceof TelegramChatServiceError) {
                return {ok: false, reason: error.code, details: message};
            }
            return {ok: false, reason: 'UNKNOWN', details: message};
        }
    }

    async publishCreativeToChannel(
        deal: DealEntity,
        creative: DealCreativeEntity,
        channel: ChannelEntity,
    ): Promise<TelegramMessageResponse> {
        const chatId = this.resolveChatId(channel);
        if (!chatId) {
            throw new Error('Channel chat id is missing.');
        }

        switch (creative.type) {
            case DealCreativeType.TEXT:
                return this.sendMessage(
                    chatId,
                    this.ensureText(creative.text ?? deal.creativeText ?? ''),
                );
            case DealCreativeType.IMAGE:
                if (!creative.mediaFileId) {
                    throw new Error('Creative media file is missing.');
                }
                return this.sendPhoto(chatId, creative.mediaFileId, {
                    caption: creative.caption ?? creative.text ?? undefined,
                });
            case DealCreativeType.VIDEO:
                if (!creative.mediaFileId) {
                    throw new Error('Creative media file is missing.');
                }
                return this.sendVideo(chatId, creative.mediaFileId, {
                    caption: creative.caption ?? creative.text ?? undefined,
                });
            default:
                this.logger.warn(
                    `Unsupported creative type for dealId=${deal.id}: ${creative.type}`,
                );
                throw new Error('Unsupported creative type.');
        }
    }

    private resolveChatId(channel: ChannelEntity): string | null {
        if (channel.telegramChatId) {
            return channel.telegramChatId;
        }
        if (channel.username) {
            return `@${channel.username}`;
        }
        return null;
    }

    private async sendMessage(
        chatId: string,
        text: string,
    ): Promise<TelegramMessageResponse> {
        return this.request<TelegramMessageResponse>('sendMessage', {
            chat_id: chatId,
            text,
        });
    }

    private async sendPhoto(
        chatId: string,
        fileId: string,
        options?: {caption?: string},
    ): Promise<TelegramMessageResponse> {
        return this.request<TelegramMessageResponse>('sendPhoto', {
            chat_id: chatId,
            photo: fileId,
            ...(options?.caption ? {caption: options.caption} : {}),
        });
    }

    private async sendVideo(
        chatId: string,
        fileId: string,
        options?: {caption?: string},
    ): Promise<TelegramMessageResponse> {
        return this.request<TelegramMessageResponse>('sendVideo', {
            chat_id: chatId,
            video: fileId,
            ...(options?.caption ? {caption: options.caption} : {}),
        });
    }

    private ensureText(text: string): string {
        if (text.trim().length === 0) {
            throw new Error('Creative text is missing.');
        }
        return text;
    }

    private async request<T>(
        method: string,
        params: Record<string, string>,
    ): Promise<T> {
        const url = `${this.apiBaseUrl}/${method}`;
        const body = new URLSearchParams(params);
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body,
        });
        const payload = (await response.json()) as TelegramApiResponse<T>;

        if (!response.ok || !payload.ok) {
            const description = payload.description || 'Telegram API error.';
            this.logger.warn(`Telegram API error on ${method}: ${description}`);
            throw new Error(description);
        }

        if (!payload.result) {
            throw new Error('Telegram API response missing result.');
        }

        return payload.result;
    }
}
