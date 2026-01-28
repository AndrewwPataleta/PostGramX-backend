import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {Markup} from 'telegraf';
import {
    TELEGRAM_MINI_APP_ROUTES,
} from '../telegram-bot.constants';

@Injectable()
export class StartHandler {
    constructor(private readonly configService: ConfigService) {}

    getMessage(): string {
        return [
            'Welcome to PostgramX',
            'Buy and sell Telegram ads with escrow and auto-posting.',
            '',
            'Use the buttons below to open the Mini App.',
        ].join('\n');
    }

    getKeyboard() {
        const openMiniAppUrl = this.buildMiniAppUrl();
        const marketplaceUrl = this.buildMiniAppUrl(TELEGRAM_MINI_APP_ROUTES.marketplace);
        const dealsUrl = this.buildMiniAppUrl(TELEGRAM_MINI_APP_ROUTES.deals);
        const channelsUrl = this.buildMiniAppUrl(TELEGRAM_MINI_APP_ROUTES.channels);

        return Markup.inlineKeyboard([
            [
                Markup.button.url('Open Mini App', openMiniAppUrl),
            ],
            [
                Markup.button.url('Marketplace', marketplaceUrl),
                Markup.button.url('My Deals', dealsUrl),
            ],
            [
                Markup.button.url('My Channels', channelsUrl),
                Markup.button.callback('Help', 'help'),
            ],
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
