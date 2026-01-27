import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {Markup} from 'telegraf';
import {
    TELEGRAM_MINI_APP_ROUTES,
    TELEGRAM_SUPPORT_URL_PLACEHOLDER,
} from '../telegram-bot.constants';

@Injectable()
export class HelpHandler {
    constructor(private readonly configService: ConfigService) {}

    getMessage(): string {
        return [
            'Need help getting started? Here is the flow:',
            '1) Advertisers create a deal in the Mini App.',
            '2) Channel owners verify their channel by adding the bot as admin.',
            '3) Escrow holds funds until the post goes live.',
            '4) Both sides can track status inside the Mini App.',
            '5) Use notifications here for quick updates.',
            '',
            'Tap a button below to continue.',
        ].join('\n');
    }

    getKeyboard() {
        const openMiniAppUrl = this.buildMiniAppUrl(TELEGRAM_MINI_APP_ROUTES.marketplace);
        const supportUrl = TELEGRAM_SUPPORT_URL_PLACEHOLDER;

        return Markup.inlineKeyboard([
            [Markup.button.url('Open Mini App', openMiniAppUrl)],
            [Markup.button.url('Support', supportUrl)],
        ]);
    }

    private buildMiniAppUrl(route?: string): string {
        const baseUrl = this.configService.get<string>('TELEGRAM_MINI_APP_URL');
        const botUsername = this.configService.get<string>('TELEGRAM_BOT_USERNAME');

        if (route && botUsername) {
            return `https://t.me/${botUsername}?startapp=${route}`;
        }

        if (baseUrl) {
            try {
                const url = new URL(baseUrl);
                if (route) {
                    url.searchParams.set('startapp', route);
                }
                return url.toString();
            } catch (error) {
                return baseUrl;
            }
        }

        if (botUsername) {
            return `https://t.me/${botUsername}`;
        }

        return 'https://t.me';
    }
}
