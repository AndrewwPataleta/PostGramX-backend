import {Injectable, Logger} from '@nestjs/common';
import {Cron} from '@nestjs/schedule';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository, DataSource} from 'typeorm';
import {ChannelEntity} from '../../channels/entities/channel.entity';
import {ChannelStatus} from '../../channels/types/channel-status.enum';
import {TelegramMtprotoSessionEntity} from '../entities/telegram-mtproto-session.entity';
import {ChannelAnalyticsCollectorService} from './channel-analytics-collector.service';
import {MtprotoClientFactory} from './mtproto-client.factory';
import {MtprotoAnalyticsConfigService} from './mtproto-analytics-config.service';
import {MtprotoClientError} from '../types/mtproto-error.types';
import {TelegramBotService} from '../../telegram-bot/telegram-bot.service';
import {ConfigService} from '@nestjs/config';

@Injectable()
export class MtprotoAnalyticsCronService {
    private readonly logger = new Logger('MtprotoAnalyticsCron');

    constructor(
        private readonly dataSource: DataSource,
        @InjectRepository(ChannelEntity)
        private readonly channelRepository: Repository<ChannelEntity>,
        @InjectRepository(TelegramMtprotoSessionEntity)
        private readonly sessionRepository: Repository<TelegramMtprotoSessionEntity>,
        private readonly collectorService: ChannelAnalyticsCollectorService,
        private readonly clientFactory: MtprotoClientFactory,
        private readonly configService: MtprotoAnalyticsConfigService,
        private readonly telegramBotService: TelegramBotService,
        private readonly appConfigService: ConfigService,
    ) {}

    @Cron(process.env.MTProto_CRON_INTERVAL || '*/30 * * * *')
    async handleCron(): Promise<void> {
        if (!this.configService.cronEnabled) {
            return;
        }

        const lockKey = 'mtproto:channel-analytics';
        const lock = await this.tryAdvisoryLock(lockKey);
        if (!lock) {
            this.logger.log('Cron skipped because advisory lock was not acquired');
            return;
        }

        try {
            await this.runCollection();
        } finally {
            await this.releaseAdvisoryLock(lockKey);
        }
    }

    private async runCollection(): Promise<void> {
        const session = await this.clientFactory.loadActiveSession('default');
        if (!session) {
            this.logger.warn('No active MTProto session found');
            return;
        }

        const allChannels = await this.channelRepository
            .createQueryBuilder('channel')
            .where('channel.status = :status', {
                status: ChannelStatus.VERIFIED,
            })
            .andWhere('channel.isDisabled = false')
            .andWhere(
                '(channel.telegramChatId IS NOT NULL OR channel.username IS NOT NULL)',
            )
            .orderBy('channel.analyticsUpdatedAt', 'ASC', 'NULLS FIRST')
            .addOrderBy('channel.id', 'ASC')
            .limit(this.configService.maxChannelsPerRun)
            .getMany();

        if (allChannels.length === 0) {
            return;
        }

        const client = await this.clientFactory.createClient(session);

        try {
            for (const channel of allChannels) {
                await this.processChannel(channel, client, session);
                await this.delay(200);
            }
        } finally {
            await client.disconnect();
        }
    }

    private async processChannel(
        channel: ChannelEntity,
        client: Awaited<ReturnType<MtprotoClientFactory['createClient']>>,
        session: TelegramMtprotoSessionEntity,
    ): Promise<void> {
        const attempts = this.configService.retryMax;
        let attempt = 0;

        while (attempt < attempts) {
            attempt += 1;
            try {
                await this.collectorService.collectForChannel(channel, client);
                await this.sessionRepository.update(session.id, {
                    lastCheckedAt: new Date(),
                    lastErrorCode: null,
                    lastErrorMessage: null,
                });
                return;
            } catch (error) {
                const mtprotoError =
                    error instanceof MtprotoClientError ? error : null;

                if (mtprotoError?.code === 'FLOOD_WAIT') {
                    await this.recordChannelError(channel, mtprotoError);
                    if (mtprotoError.waitSeconds) {
                        await this.delay(mtprotoError.waitSeconds * 1000);
                    }
                    return;
                }

                if (mtprotoError?.code === 'AUTH_REVOKED') {
                    await this.handleSessionRevoked(session, mtprotoError);
                    return;
                }

                if (mtprotoError?.code === 'NETWORK_ERROR') {
                    if (attempt < attempts) {
                        await this.delay(this.backoffDelay(attempt));
                        continue;
                    }
                }

                await this.recordChannelError(channel, mtprotoError ?? error);
                await this.sessionRepository.update(session.id, {
                    lastCheckedAt: new Date(),
                    lastErrorCode: mtprotoError?.code ?? 'UNKNOWN',
                    lastErrorMessage:
                        error instanceof Error ? error.message : String(error),
                });
                return;
            }
        }
    }

    private async recordChannelError(
        channel: ChannelEntity,
        error: MtprotoClientError | unknown,
    ): Promise<void> {
        const now = new Date();
        const message = error instanceof Error ? error.message : String(error);
        const code = error instanceof MtprotoClientError ? error.code : 'UNKNOWN';
        await this.channelRepository.update(channel.id, {
            mtprotoLastErrorCode: code,
            mtprotoLastErrorMessage: message,
            mtprotoLastErrorAt: now,
        });
    }

    private async handleSessionRevoked(
        session: TelegramMtprotoSessionEntity,
        error: MtprotoClientError,
    ): Promise<void> {
        await this.sessionRepository.update(session.id, {
            isActive: false,
            lastCheckedAt: new Date(),
            lastErrorCode: error.code,
            lastErrorMessage: error.message,
        });

        const chatId = this.appConfigService.get<string>('ADMIN_ALERTS_CHAT_ID');
        if (chatId) {
            await this.telegramBotService.sendMessage(
                chatId,
                `MTProto session ${session.label} was revoked and disabled.`,
            );
        }
    }

    private backoffDelay(attempt: number): number {
        const base = this.configService.retryBaseDelayMs;
        const jitter = Math.floor(Math.random() * base);
        return base * Math.pow(2, attempt - 1) + jitter;
    }

    private async delay(ms: number): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, ms));
    }

    private async tryAdvisoryLock(key: string): Promise<boolean> {
        const result = await this.dataSource.query(
            'SELECT pg_try_advisory_lock(hashtext($1)) as acquired',
            [key],
        );
        return Boolean(result?.[0]?.acquired);
    }

    private async releaseAdvisoryLock(key: string): Promise<void> {
        await this.dataSource.query(
            'SELECT pg_advisory_unlock(hashtext($1))',
            [key],
        );
    }
}
