import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';

@Injectable()
export class PreDealsDeepLinkService {
    constructor(private readonly configService: ConfigService) {}

    buildBotStartLink(preDealId: string): string {
        const botUsername = this.configService.get<string>('TELEGRAM_BOT_USERNAME');
        const startParam = `predeal_${preDealId}`;

        if (botUsername) {
            return `https://t.me/${botUsername}?start=${startParam}`;
        }

        return 'https://t.me';
    }

    buildPaymentLink(preDealId: string): string {
        const botUsername = this.configService.get<string>('TELEGRAM_BOT_USERNAME');
        const miniAppShortName = this.configService.get<string>(
            'TELEGRAM_MINIAPP_SHORT_NAME',
        );
        const baseUrl = this.configService.get<string>('TELEGRAM_MINI_APP_URL');
        const startParam = `pay_predeal_${preDealId}`;

        if (botUsername && miniAppShortName) {
            return `https://t.me/${botUsername}/${miniAppShortName}?startapp=${startParam}`;
        }

        if (botUsername) {
            return `https://t.me/${botUsername}?startapp=${startParam}`;
        }

        if (baseUrl) {
            try {
                const url = new URL(baseUrl);
                url.searchParams.set('startapp', startParam);
                return url.toString();
            } catch (error) {
                return baseUrl;
            }
        }

        return 'https://t.me';
    }
}
