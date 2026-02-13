import { Injectable, Logger } from '@nestjs/common';
import { TelegramApiService } from '../../../core/telegram-api.service';
import { TelegramMessage } from '../../deals/publication/telegramMessageFingerprint';

export class TelegramMessageNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = TelegramMessageNotFoundError.name;
  }
}

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

@Injectable()
export class TelegramChannelPostsService {
  private readonly logger = new Logger(TelegramChannelPostsService.name);
  private readonly apiBaseUrl: string;

  constructor(private readonly telegramApiService: TelegramApiService) {
    this.apiBaseUrl = this.telegramApiService.getApiBaseUrl();
  }

  async getChannelMessage(
    chatId: string,
    messageId: string,
  ): Promise<TelegramMessage | null> {
    const response = await this.request<TelegramMessage>('getMessage', {
      chat_id: chatId,
      message_id: messageId,
    });

    if (!response.result) {
      throw new TelegramMessageNotFoundError(
        `MESSAGE_NOT_FOUND: chatId=${chatId} messageId=${messageId}`,
      );
    }

    return response.result;
  }

  private async request<T>(
    method: string,
    params: Record<string, string>,
  ): Promise<TelegramApiResponse<T>> {
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
      const errorCode = payload.error_code;
      const normalizedDescription = description.toLowerCase();

      if (
        normalizedDescription.includes('message to get not found') ||
        normalizedDescription.includes('message not found')
      ) {
        throw new TelegramMessageNotFoundError(
          `${errorCode ?? 400}:${description}`,
        );
      }

      this.logger.warn(
        `Failed to fetch channel message via ${method}: ${description} (code=${errorCode ?? 'unknown'})`,
      );
      throw new Error(`${errorCode ?? 'UNKNOWN'}:${description}`);
    }

    return payload;
  }
}
