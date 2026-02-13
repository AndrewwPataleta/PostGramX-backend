import { Injectable, Logger } from '@nestjs/common';
import { TelegramApiService } from '../../../core/telegram-api.service';

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
      this.logger.debug(
        `Telegram API request getMessage views: chat=${telegramChatId} message=${messageId}`,
      );

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });

      this.logger.debug(
        `Telegram API response getMessage views: HTTP ${response.status} for chat=${telegramChatId} message=${messageId}`,
      );

      if (!response.ok) {
        this.logger.warn(
          `Telegram API getMessage views failed with HTTP ${response.status} for chat=${telegramChatId} message=${messageId}`,
        );
        return null;
      }

      const payload =
        (await response.json()) as TelegramApiResponse<TelegramMessageResult>;
      if (!payload.ok || !payload.result) {
        this.logger.warn(
          `Telegram API getMessage views returned empty result for chat=${telegramChatId} message=${messageId}`,
        );
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
