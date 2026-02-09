import {Injectable, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {TelegramClient} from 'telegram';
import {StringSession} from 'telegram/sessions';
import {Api} from 'telegram';
import {RPCError} from 'telegram/errors';
import {TelegramMtprotoSessionEntity} from '../entities/telegram-mtproto-session.entity';
import {MtprotoSessionCryptoService} from './mtproto-session-crypto.service';
import {MtprotoAnalyticsConfigService} from './mtproto-analytics-config.service';
import {MtprotoClient} from '../types/mtproto-client.interface';
import {MtprotoClientError, MtprotoErrorCode} from '../types/mtproto-error.types';
import {IsNull} from 'typeorm';

class GramJsMtprotoClient implements MtprotoClient {
    private readonly logger = new Logger('MtprotoClient');
    private readonly client: TelegramClient;
    private connected = false;

    constructor(
        apiId: number,
        apiHash: string,
        session: string,
    ) {
        const stringSession = new StringSession(session);
        this.client = new TelegramClient(stringSession, apiId, apiHash, {
            connectionRetries: 1,
        });
    }

    async connect(): Promise<void> {
        if (this.connected) {
            return;
        }
        await this.client.connect();
        this.connected = true;
        this.logger.log('MTProto client connected');
    }

    async disconnect(): Promise<void> {
        if (!this.connected) {
            return;
        }
        await this.client.disconnect();
        this.connected = false;
        this.logger.log('MTProto client disconnected');
    }

    async getChannelFull(usernameOrId: string): Promise<{subscribersCount?: number}> {
        await this.connect();
        try {
            const entity = await this.client.getEntity(usernameOrId);
            const result = await this.client.invoke(
                new Api.channels.GetFullChannel({channel: entity}),
            );
            const fullChat = (result as Api.messages.ChatFull).fullChat;
            const participantsCount =
                'participantsCount' in fullChat
                    ? (fullChat.participantsCount as number | undefined)
                    : undefined;
            return {subscribersCount: participantsCount};
        } catch (error) {
            throw this.mapError(error);
        }
    }

    async getRecentPosts(
        usernameOrId: string,
        limit: number,
    ): Promise<
        Array<{
            id: string;
            date: number;
            text?: string;
            views?: number;
            forwards?: number;
            replies?: number;
        }>
    > {
        await this.connect();
        try {
            const entity = await this.client.getEntity(usernameOrId);
            const messages = await this.client.getMessages(entity, {limit});
            return messages
                .filter((message) => message)
                .map((message) => ({
                    id: String(message.id),
                    date: message.date,
                    text: message.message ?? undefined,
                    views: message.views ?? undefined,
                    forwards: message.forwards ?? undefined,
                    replies: message.replies?.replies ?? undefined,
                }));
        } catch (error) {
            throw this.mapError(error);
        }
    }

    private mapError(error: unknown): MtprotoClientError {
        if (error instanceof MtprotoClientError) {
            return error;
        }

        if (error instanceof RPCError) {
            const message = error.errorMessage ?? error.message;
            if (message?.startsWith('FLOOD_WAIT_')) {
                const waitSeconds = Number(message.split('_').pop());
                return new MtprotoClientError(
                    'FLOOD_WAIT',
                    message,
                    Number.isFinite(waitSeconds) ? waitSeconds : undefined,
                );
            }
            if (
                message === 'SESSION_REVOKED' ||
                message === 'AUTH_KEY_UNREGISTERED'
            ) {
                return new MtprotoClientError('AUTH_REVOKED', message);
            }
            if (message === 'CHANNEL_PRIVATE') {
                return new MtprotoClientError('CHANNEL_PRIVATE', message);
            }
            if (
                message === 'USER_BANNED_IN_CHANNEL' ||
                message === 'USER_DEACTIVATED_BAN'
            ) {
                return new MtprotoClientError('USER_BANNED', message);
            }
            return new MtprotoClientError('UNKNOWN', message ?? 'RPC error');
        }

        const message = error instanceof Error ? error.message : String(error);
        const networkSignals = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'];
        if (networkSignals.some((signal) => message.includes(signal))) {
            return new MtprotoClientError('NETWORK_ERROR', message);
        }
        return new MtprotoClientError('UNKNOWN', message);
    }
}

@Injectable()
export class MtprotoClientFactory {
    private readonly logger = new Logger('MtprotoClientFactory');

    constructor(
        @InjectRepository(TelegramMtprotoSessionEntity)
        private readonly sessionRepository: Repository<TelegramMtprotoSessionEntity>,
        private readonly cryptoService: MtprotoSessionCryptoService,
        private readonly configService: MtprotoAnalyticsConfigService,
    ) {}

    async loadActiveSession(
        label = 'default',
    ): Promise<TelegramMtprotoSessionEntity | null> {
        return this.sessionRepository.findOne({
            where: {label, isActive: true, userId: IsNull()},
        });
    }

    async createClient(
        session: TelegramMtprotoSessionEntity,
    ): Promise<MtprotoClient> {
        const decrypted = this.cryptoService.decrypt(session.encryptedSession);
        this.logger.log(`Initializing MTProto client for label ${session.label}`);
        return new GramJsMtprotoClient(
            this.configService.apiId,
            this.configService.apiHash,
            decrypted,
        );
    }

    mapError(error: unknown): MtprotoErrorCode {
        if (error instanceof MtprotoClientError) {
            return error.code;
        }
        return 'UNKNOWN';
    }
}
