import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {TELEGRAM_SUPPORT_URL_PLACEHOLDER} from '../telegram-bot.constants';
import {TelegramInlineButtonSpec} from "../../telegram/telegram-messenger.service";

@Injectable()
export class StartHandler {
    constructor(private readonly configService: ConfigService) {}

    getButtons(): TelegramInlineButtonSpec[][] {
        const openMiniAppUrl = this.buildMiniAppUrl();
        const supportUrl = this.buildSupportUrl();

        return [
            [
                {textKey: 'telegram.common.open_mini_app', url: openMiniAppUrl},
            ],
            [
                {textKey: 'telegram.common.about_escrow', callbackData: 'about_escrow'},
            ],
            [
                {textKey: 'telegram.common.support', url: supportUrl},
            ],
        ];
    }

    private buildMiniAppUrl(route?: string): string {
        const baseUrl =
            this.configService.get<string>('TELEGRAM_MINIAPP_URL') ||
            this.configService.get<string>('TELEGRAM_MINI_APP_URL');
        const botUsername = this.configService.get<string>('TELEGRAM_BOT_USERNAME');

        if (route && botUsername) {
            return `https://t.me/${botUsername}?startapp=${route}`;
        }

        if (baseUrl) {
            const safeBase = this.ensureHttpsUrl(baseUrl);
            if (!safeBase) {
                return 'https://t.me';
            }
            try {
                const url = new URL(safeBase);
                if (route) {
                    url.searchParams.set('startapp', route);
                }
                return url.toString();
            } catch (error) {
                return safeBase;
            }
        }

        if (botUsername) {
            return `https://t.me/${botUsername}`;
        }

        return 'https://t.me';
    }

    private ensureHttpsUrl(value: string): string | null {
        try {
            const url = new URL(value);
            return url.protocol === 'https:' ? url.toString() : null;
        } catch (error) {
            return null;
        }
    }

    private buildSupportUrl(): string {
        const configured = this.configService.get<string>('TELEGRAM_SUPPORT_URL');
        const resolved = configured?.trim() || TELEGRAM_SUPPORT_URL_PLACEHOLDER;
        return this.normalizeTelegramLink(resolved);
    }

    private normalizeTelegramLink(value: string): string {
        const trimmed = value.trim();
        if (trimmed.startsWith('@')) {
            return `https://t.me/${trimmed.slice(1)}`;
        }
        if (!trimmed.includes('://')) {
            return `https://t.me/${trimmed}`;
        }
        return this.ensureHttpsUrl(trimmed) ?? 'https://t.me';
    }
}
