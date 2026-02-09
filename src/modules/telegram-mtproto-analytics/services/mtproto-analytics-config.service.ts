import {Injectable, Logger} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';

@Injectable()
export class MtprotoAnalyticsConfigService {
    private readonly logger = new Logger('MtprotoAnalyticsConfig');

    readonly apiId: number;
    readonly apiHash: string;
    readonly sessionEncryptionKey: string;
    readonly cronEnabled: boolean;
    readonly cronInterval: string;
    readonly postsSampleSize: number;
    readonly lastPostsLimit: number;
    readonly maxChannelsPerRun: number;
    readonly retryMax: number;
    readonly retryBaseDelayMs: number;
    readonly adminToken: string | null;

    constructor(private readonly configService: ConfigService) {
        this.apiId = this.getNumber('MTProto_API_ID');
        this.apiHash = this.getRequired('MTProto_API_HASH');
        this.sessionEncryptionKey = this.getRequired(
            'MTProto_SESSION_ENCRYPTION_KEY',
        );
        this.cronEnabled = this.getBoolean('MTProto_CRON_ENABLED', true);
        this.cronInterval =
            this.configService.get<string>('MTProto_CRON_INTERVAL') ??
            '*/30 * * * *';
        this.postsSampleSize = this.getNumber(
            'MTProto_POSTS_SAMPLE_SIZE',
            20,
        );
        this.lastPostsLimit = this.getNumber('MTProto_LAST_POSTS_LIMIT', 10);
        this.maxChannelsPerRun = this.getNumber(
            'MTProto_MAX_CHANNELS_PER_RUN',
            50,
        );
        this.retryMax = this.getNumber('MTProto_RETRY_MAX', 3);
        this.retryBaseDelayMs = this.getNumber(
            'MTProto_RETRY_BASE_DELAY_MS',
            500,
        );
        this.adminToken =
            this.configService.get<string>('MTProto_ADMIN_TOKEN') ?? null;

        this.validate();
        this.logLoaded();
    }

    private validate(): void {
        if (!this.apiId || !this.apiHash) {
            throw new Error('MTProto_API_ID and MTProto_API_HASH are required');
        }
        if (!this.sessionEncryptionKey || this.sessionEncryptionKey.length < 32) {
            throw new Error(
                'MTProto_SESSION_ENCRYPTION_KEY must be at least 32 characters',
            );
        }
        if (this.postsSampleSize <= 0) {
            throw new Error('MTProto_POSTS_SAMPLE_SIZE must be positive');
        }
        if (this.lastPostsLimit <= 0) {
            throw new Error('MTProto_LAST_POSTS_LIMIT must be positive');
        }
    }

    private logLoaded(): void {
        this.logger.log(
            [
                'MTProto analytics config loaded',
                `cronEnabled=${this.cronEnabled}`,
                `cronInterval=${this.cronInterval}`,
                `postsSampleSize=${this.postsSampleSize}`,
                `lastPostsLimit=${this.lastPostsLimit}`,
                `maxChannelsPerRun=${this.maxChannelsPerRun}`,
                `retryMax=${this.retryMax}`,
            ].join(' | '),
        );
    }

    private getRequired(key: string): string {
        const value = this.configService.get<string>(key);
        if (!value) {
            throw new Error(`${key} is required`);
        }
        return value;
    }

    private getNumber(key: string, fallback?: number): number {
        const raw = this.configService.get<string>(key);
        if (!raw) {
            if (fallback !== undefined) {
                return fallback;
            }
            throw new Error(`${key} is required`);
        }
        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed <= 0) {
            if (fallback !== undefined) {
                return fallback;
            }
            throw new Error(`${key} must be a positive number`);
        }
        return parsed;
    }

    private getBoolean(key: string, fallback: boolean): boolean {
        const raw = this.configService.get<string>(key);
        if (!raw) {
            return fallback;
        }
        return ['true', '1', 'yes', 'y'].includes(raw.toLowerCase());
    }
}
