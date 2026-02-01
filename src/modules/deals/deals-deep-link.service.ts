import {Injectable, Logger} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';

@Injectable()
export class DealsDeepLinkService {
    private readonly logger = new Logger(DealsDeepLinkService.name);

    constructor(private readonly configService: ConfigService) {}

    buildDealLink(dealId: string): string {
        const miniAppUrl = this.configService.get<string>('MINI_APP_URL');
        if (miniAppUrl) {
            try {
                const url = new URL(miniAppUrl);
                if (url.protocol !== 'https:') {
                    this.logger.warn('MINI_APP_URL must be https; falling back.');
                    return miniAppUrl;
                }
                url.pathname = `${url.pathname.replace(/\/$/, '')}/deals/${dealId}`;
                return url.toString();
            } catch (error) {
                return miniAppUrl;
            }
        }

        const botUsername = this.configService.get<string>('TELEGRAM_BOT_USERNAME');
        const miniAppShortName = this.configService.get<string>(
            'TELEGRAM_MINIAPP_SHORT_NAME',
        );
        const startParam = `deal_${dealId}`;

        if (botUsername && miniAppShortName) {
            return `https://t.me/${botUsername}/${miniAppShortName}?startapp=${startParam}`;
        }

        if (botUsername) {
            return `https://t.me/${botUsername}?startapp=${startParam}`;
        }

        return 'https://t.me';
    }
}
