import {Injectable, Logger} from '@nestjs/common';
import {TelegramApiService} from '../../../core/telegram-api.service';

interface TelegramApiResponse<T> {
    ok: boolean;
    result?: T;
}

interface TelegramMessageResult {
    views?: number;
}

@Injectable()
export class TelegramMessageStatsService {
    private readonly logger = new Logger(TelegramMessageStatsService.name);
    private readonly apiBaseUrl: string;

    constructor(private readonly telegramApiService: TelegramApiService) {
        this.apiBaseUrl = this.telegramApiService.getApiBaseUrl();
    }

    async getMessageViews(
        telegramChatId: string,
        messageId: string,
    ): Promise<number | null> {
        try {
            const url = `${this.apiBaseUrl}/getMessage`;
            const body = new URLSearchParams({
                chat_id: telegramChatId,
                message_id: messageId,
            });
            const response = await fetch(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                body,
            });

            if (!response.ok) {
                return null;
            }

            const payload =
                (await response.json()) as TelegramApiResponse<TelegramMessageResult>;
            if (!payload.ok || !payload.result) {
                return null;
            }

            return typeof payload.result.views === 'number'
                ? payload.result.views
                : null;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.warn(
                `Failed to fetch views chat=${telegramChatId} message=${messageId}: ${message}`,
            );
            return null;
        }
    }
}
