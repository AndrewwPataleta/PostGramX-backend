import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {ServiceError} from '../../core/service-error';

export enum TelegramChatErrorCode {
    CHANNEL_NOT_FOUND = 'CHANNEL_NOT_FOUND',
    BOT_FORBIDDEN = 'BOT_FORBIDDEN',
    NOT_A_CHANNEL = 'NOT_A_CHANNEL',
    CHANNEL_PRIVATE_OR_NO_USERNAME = 'CHANNEL_PRIVATE_OR_NO_USERNAME',
    BOT_NOT_ADMIN = 'BOT_NOT_ADMIN',
    BOT_MISSING_RIGHTS = 'BOT_MISSING_RIGHTS',
    INVALID_USERNAME = 'INVALID_USERNAME',
}

export class TelegramChatServiceError extends ServiceError<TelegramChatErrorCode> {
    constructor(code: TelegramChatErrorCode) {
        super(code);
    }
}

interface TelegramApiResponse<T> {
    ok: boolean;
    result?: T;
    description?: string;
    error_code?: number;
}

export interface TelegramChat {
    id: number;
    type: string;
    title?: string;
    username?: string;
}

export interface TelegramUser {
    id: number;
    is_bot: boolean;
    username?: string;
    first_name?: string;
    last_name?: string;
}

export interface TelegramChatMember {
    status: string;
    user: TelegramUser;
    can_post_messages?: boolean;
    can_edit_messages?: boolean;
    can_delete_messages?: boolean;
    can_manage_chat?: boolean;
    can_manage_video_chats?: boolean;
    can_change_info?: boolean;
    can_invite_users?: boolean;
    can_pin_messages?: boolean;
    can_promote_members?: boolean;
}

@Injectable()
export class TelegramChatService {
    private readonly apiBaseUrl: string;
    private botInfoPromise?: Promise<TelegramUser>;

    constructor(private readonly configService: ConfigService) {
        const token = this.configService.get<string>('BOT_TOKEN');
        if (!token) {
            throw new Error('BOT_TOKEN is required for TelegramChatService');
        }
        const baseUrl = this.configService.get<string>('TELEGRAM_BOT_API_BASE_URL');
        this.apiBaseUrl = baseUrl ?? `https://api.telegram.org/bot${token}`;
    }

    normalizeUsernameOrLink(input: string): string {
        const trimmed = input?.trim();
        if (!trimmed) {
            throw new TelegramChatServiceError(
                TelegramChatErrorCode.INVALID_USERNAME,
            );
        }

        let candidate = trimmed;

        if (candidate.startsWith('@')) {
            candidate = candidate.slice(1);
        } else if (candidate.includes('t.me/')) {
            const withoutProtocol = candidate.replace(/^https?:\/\//, '');
            const parts = withoutProtocol.split('t.me/');
            if (parts.length > 1) {
                candidate = parts[1].split(/[/?#]/)[0];
            }
        }

        const normalized = candidate.toLowerCase();
        const isValid = /^[a-zA-Z0-9_]{5,32}$/.test(normalized);
        if (!isValid) {
            throw new TelegramChatServiceError(
                TelegramChatErrorCode.INVALID_USERNAME,
            );
        }

        return normalized;
    }

    async getChatByUsername(username: string): Promise<TelegramChat> {
        return this.request<TelegramChat>('getChat', {
            chat_id: `@${username}`,
        });
    }

    async getChatAdministratorsByUsername(
        username: string,
    ): Promise<TelegramChatMember[]> {
        return this.request<TelegramChatMember[]>('getChatAdministrators', {
            chat_id: `@${username}`,
        });
    }

    assertPublicChannel(chat: TelegramChat | null | undefined): TelegramChat {
        if (!chat) {
            throw new TelegramChatServiceError(
                TelegramChatErrorCode.CHANNEL_NOT_FOUND,
            );
        }

        if (chat.type !== 'channel') {
            throw new TelegramChatServiceError(
                TelegramChatErrorCode.NOT_A_CHANNEL,
            );
        }

        if (!chat.username) {
            throw new TelegramChatServiceError(
                TelegramChatErrorCode.CHANNEL_PRIVATE_OR_NO_USERNAME,
            );
        }

        return chat;
    }

    async extractBotAdmin(admins: TelegramChatMember[]) {
        const bot = await this.getBotIdentity();
        const botAdmin = admins.find(
            (admin) => admin.user?.id === bot.id,
        );

        if (!botAdmin) {
            throw new TelegramChatServiceError(
                TelegramChatErrorCode.BOT_NOT_ADMIN,
            );
        }

        if (!botAdmin.can_post_messages) {
            throw new TelegramChatServiceError(
                TelegramChatErrorCode.BOT_MISSING_RIGHTS,
            );
        }

        return {bot, botAdmin};
    }

    private async getBotIdentity(): Promise<TelegramUser> {
        if (!this.botInfoPromise) {
            this.botInfoPromise = this.request<TelegramUser>('getMe', {});
        }
        return this.botInfoPromise;
    }

    private async request<T>(
        method: string,
        params: Record<string, string>,
    ): Promise<T> {
        const query = new URLSearchParams(params).toString();
        const url = `${this.apiBaseUrl}/${method}?${query}`;
        const response = await fetch(url);
        const payload = (await response.json()) as TelegramApiResponse<T>;

        if (!response.ok || !payload.ok) {
            this.throwTelegramError(payload);
        }

        if (!payload.result) {
            throw new TelegramChatServiceError(
                TelegramChatErrorCode.CHANNEL_NOT_FOUND,
            );
        }

        return payload.result;
    }

    private throwTelegramError(payload: TelegramApiResponse<unknown>): never {
        const description = payload.description || 'Telegram API error.';
        const errorCode = payload.error_code;

        if (errorCode === 403) {
            throw new TelegramChatServiceError(
                TelegramChatErrorCode.BOT_FORBIDDEN,
            );
        }

        if (description.toLowerCase().includes('not enough rights')) {
            throw new TelegramChatServiceError(
                TelegramChatErrorCode.BOT_NOT_ADMIN,
            );
        }

        if (errorCode === 400 && description.toLowerCase().includes('chat not found')) {
            throw new TelegramChatServiceError(
                TelegramChatErrorCode.CHANNEL_NOT_FOUND,
            );
        }

        throw new TelegramChatServiceError(
            TelegramChatErrorCode.BOT_FORBIDDEN,
        );
    }
}
