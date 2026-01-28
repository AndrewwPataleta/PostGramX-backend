import {Injectable} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';

@Injectable()
export class DealsDeepLinkService {
    constructor(private readonly configService: ConfigService) {}

    buildDealLink(dealId: string): string {
        const botUsername = this.configService.get<string>('TELEGRAM_BOT_USERNAME');
        const miniAppShortName = this.configService.get<string>(
            'TELEGRAM_MINIAPP_SHORT_NAME',
        );
        const baseUrl = this.configService.get<string>('TELEGRAM_MINI_APP_URL');
        const startParam = `deal_${dealId}`;

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
