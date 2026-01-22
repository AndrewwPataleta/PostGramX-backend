import { Injectable } from "@nestjs/common";
import axios, { AxiosError } from "axios";
import { ApiError } from "../common/errors/api-error";
import { AppConfigService } from "../config/app-config.service";

interface TelegramResponse<T> {
  ok: boolean;
  result: T;
  description?: string;
  error_code?: number;
  parameters?: { retry_after?: number };
}

@Injectable()
export class TelegramApiService {
  private readonly baseUrl: string;

  constructor(private readonly config: AppConfigService) {
    this.baseUrl = `https://api.telegram.org/bot${this.config.telegramBotToken}`;
  }

  async getChat(chatIdOrUsername: string | number) {
    return this.request("getChat", { chat_id: chatIdOrUsername });
  }

  async getChatAdministrators(chatIdOrUsername: string | number) {
    return this.request("getChatAdministrators", { chat_id: chatIdOrUsername });
  }

  async getChatMemberCount(chatIdOrUsername: string | number) {
    return this.request("getChatMemberCount", { chat_id: chatIdOrUsername });
  }

  async getFile(fileId: string) {
    return this.request("getFile", { file_id: fileId });
  }

  private async request<T>(method: string, payload: Record<string, unknown>): Promise<T> {
    try {
      const response = await axios.post<TelegramResponse<T>>(`${this.baseUrl}/${method}`, payload);
      if (!response.data.ok) {
        throw new ApiError(502, "TELEGRAM_ERROR", response.data.description ?? "Telegram error");
      }
      return response.data.result;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      const axiosError = error as AxiosError<TelegramResponse<T>>;
      if (axiosError.response?.data?.error_code) {
        const { error_code: errorCode, description, parameters } = axiosError.response.data;
        if (errorCode === 400) {
          throw new ApiError(404, "CHAT_NOT_FOUND", description ?? "Chat not found");
        }
        if (errorCode === 403) {
          throw new ApiError(403, "BOT_FORBIDDEN", description ?? "Bot is forbidden");
        }
        if (errorCode === 429) {
          throw new ApiError(429, "TELEGRAM_RATE_LIMITED", description ?? "Rate limited", {
            retryAfter: parameters?.retry_after
          });
        }
      }

      throw new ApiError(502, "TELEGRAM_ERROR", "Telegram request failed");
    }
  }
}
