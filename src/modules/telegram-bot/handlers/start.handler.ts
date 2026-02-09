import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {TELEGRAM_SUPPORT_URL_PLACEHOLDER} from '../telegram-bot.constants';
import {TelegramInlineButtonSpec} from "../../telegram/telegram-messenger.service";

@Injectable()
export class StartHandler {
    constructor(private readonly configService: ConfigService) {}

    getButtons(): TelegramInlineButtonSpec[][] {
        const miniAppButton = this.buildMiniAppButton();
        const supportUrl = this.buildSupportUrl();

        const buttons: TelegramInlineButtonSpec[][] = [];

        if (miniAppButton) {
            buttons.push([miniAppButton]);
        }

        buttons.push([{textKey: 'telegram.common.about_escrow', callbackData: 'about_escrow'}]);
        buttons.push([{textKey: 'telegram.common.support', url: supportUrl}]);

        return buttons;
    }

    private buildMiniAppButton(route?: string): TelegramInlineButtonSpec | null {
        const webAppUrl = this.buildMiniAppWebAppUrl(route);
        if (webAppUrl) {
            return {
                textKey: 'telegram.common.open_mini_app',
                webAppUrl,
            };
        }

        const fallbackUrl = this.buildMiniAppFallbackUrl(route);
        if (fallbackUrl) {
            return {
                textKey: 'telegram.common.open_mini_app',
                url: fallbackUrl,
            };
        }

        return null;
    }

    private buildMiniAppWebAppUrl(route?: string): string | null {
        const baseUrl =
            this.configService.get<string>('TELEGRAM_MINIAPP_URL') ||
            this.configService.get<string>('TELEGRAM_MINI_APP_URL') ||
            this.configService.get<string>('MINI_APP_URL');

        if (baseUrl) {
            const safeBase = this.ensureHttpsUrl(baseUrl);
            if (!safeBase) {
                return null;
            }
            try {
                const url = new URL(safeBase);
                if (route) {
                    url.pathname = `${url.pathname.replace(/\/$/, '')}/${route}`;
                }
                return url.toString();
            } catch (error) {
                return null;
            }
        }

        return null;
    }

    private buildMiniAppFallbackUrl(route?: string): string | null {
        const botUsername = this.normalizeBotUsername(
            this.configService.get<string>('TELEGRAM_BOT_USERNAME'),
        );

        if (botUsername) {
            return route
                ? `https://t.me/${botUsername}?startapp=${route}`
                : `https://t.me/${botUsername}`;
        }

        return null;
    }

    private ensureHttpsUrl(value: string): string | null {
        try {
            const url = new URL(value);
            return url.protocol === 'https:' ? url.toString() : null;
        } catch (error) {
            return null;
        }
    }

    private normalizeBotUsername(value?: string | null): string | undefined {
        if (!value) {
            return undefined;
        }
        const trimmed = value.trim();
        return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
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
