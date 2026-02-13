import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { MTPROTO_MONITOR_CONFIG } from '../mtproto-monitor.config';

const gramjs = require('telegram');
const { StringSession } = require('telegram/sessions');
const { Raw } = require('telegram/events');

const TelegramClient = gramjs.TelegramClient;
const Api = gramjs.Api;

type TelegramClientInstance = any;
type GramMessage = any;

export interface MtprotoChannelMessage {
  id: number;
  text: string | null;
  mediaUniqueId: string | null;
  entitiesSignature: string | null;
}

@Injectable()
export class MtprotoClientService implements OnModuleInit, OnModuleDestroy {
  private static sharedClient: TelegramClientInstance | null = null;
  private static connectPromise: Promise<void> | null = null;
  private static disconnectPromise: Promise<void> | null = null;
  private static updatesBound = false;

  private readonly logger = new Logger(MtprotoClientService.name);

  async onModuleInit(): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    await this.withRetry(async () => {
      await this.ensureConnected();
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (!MtprotoClientService.sharedClient) {
      return;
    }

    if (!MtprotoClientService.disconnectPromise) {
      MtprotoClientService.disconnectPromise = (async () => {
        await MtprotoClientService.sharedClient?.disconnect();
        MtprotoClientService.sharedClient = null;
        MtprotoClientService.connectPromise = null;
        MtprotoClientService.updatesBound = false;
      })().finally(() => {
        MtprotoClientService.disconnectPromise = null;
      });
    }

    await MtprotoClientService.disconnectPromise;
  }

  isEnabled(): boolean {
    return (
      MTPROTO_MONITOR_CONFIG.ENABLED &&
      MTPROTO_MONITOR_CONFIG.PROVIDER === 'mtproto'
    );
  }

  async getChannelMessage(
    peer: string,
    messageId: number,
  ): Promise<MtprotoChannelMessage | null> {
    return this.withRetry(async () => {
      const client = await this.getConnectedClient();
      const messages = await client.getMessages(peer, {
        ids: [messageId],
      });

      const message = messages[0];
      if (!message || typeof message.id !== 'number') {
        return null;
      }

      return this.mapMessage(message);
    });
  }

  async getPinnedMessage(peer: string): Promise<number | null> {
    return this.withRetry(async () => {
      const client = await this.getConnectedClient();
      const channel = await client.getEntity(peer);
      const fullChannel = await client.invoke(
        new Api.channels.GetFullChannel({ channel }),
      );

      return Number(fullChannel.fullChat?.pinnedMsgId ?? 0) || null;
    });
  }

  async getChannelHistorySlice(
    peer: string,
    aroundMessageId: number,
  ): Promise<MtprotoChannelMessage[]> {
    return this.withRetry(async () => {
      const client = await this.getConnectedClient();
      const ids = Array.from(
        { length: 5 },
        (_, index) => aroundMessageId - 2 + index,
      ).filter((id) => id > 0);

      const messages = await client.getMessages(peer, { ids });
      return messages
        .filter((message: GramMessage) =>
          Boolean(message && typeof message.id === 'number'),
        )
        .sort((a: GramMessage, b: GramMessage) => a.id - b.id)
        .map((message: GramMessage) => this.mapMessage(message));
    });
  }

  private async getConnectedClient(): Promise<TelegramClientInstance> {
    await this.ensureConnected();

    if (
      !MtprotoClientService.sharedClient ||
      !MtprotoClientService.sharedClient.connected
    ) {
      throw new Error('MTPROTO_CLIENT_NOT_CONNECTED');
    }

    return MtprotoClientService.sharedClient;
  }

  private async ensureConnected(): Promise<void> {
    this.validateConfig();

    if (!MtprotoClientService.sharedClient) {
      MtprotoClientService.sharedClient = new TelegramClient(
        new StringSession(MTPROTO_MONITOR_CONFIG.SESSION),
        MTPROTO_MONITOR_CONFIG.API_ID,
        MTPROTO_MONITOR_CONFIG.API_HASH,
        {
          connectionRetries: 1,
          useWSS: false,
        },
      );
    }

    if (MtprotoClientService.sharedClient.connected) {
      return;
    }

    if (!MtprotoClientService.connectPromise) {
      MtprotoClientService.connectPromise = (async () => {
        await MtprotoClientService.sharedClient?.connect();
        this.bindUpdateListener();
        this.logger.log('MTProto client connected');
      })().finally(() => {
        MtprotoClientService.connectPromise = null;
      });
    }

    await MtprotoClientService.connectPromise;
  }

  private bindUpdateListener(): void {
    if (
      !MtprotoClientService.sharedClient ||
      MtprotoClientService.updatesBound
    ) {
      return;
    }

    MtprotoClientService.sharedClient.addEventHandler((update: any) => {
      if (update instanceof Api.UpdateEditChannelMessage) {
        this.logger.debug(
          `MTProto update: edited channel message ${update.message.id}`,
        );
      }

      if (update instanceof Api.UpdateDeleteChannelMessages) {
        this.logger.debug(
          `MTProto update: deleted channel messages ${update.messages.join(',')}`,
        );
      }

      if (update instanceof Api.UpdateChannelPinnedMessage) {
        this.logger.debug(
          `MTProto update: pinned message changed in channel ${update.channelId}`,
        );
      }
    }, new Raw({}));

    MtprotoClientService.updatesBound = true;
  }

  private mapMessage(message: GramMessage): MtprotoChannelMessage {
    return {
      id: message.id,
      text: message.message ?? null,
      mediaUniqueId: this.extractMediaUniqueId(message),
      entitiesSignature: this.extractEntitiesSignature(message),
    };
  }

  private extractMediaUniqueId(message: GramMessage): string | null {
    if (message.media?.document?.id) {
      return `document:${message.media.document.id}`;
    }

    if (message.media?.photo?.id) {
      return `photo:${message.media.photo.id}`;
    }

    return null;
  }

  private extractEntitiesSignature(message: GramMessage): string | null {
    if (!message.entities?.length) {
      return null;
    }

    return message.entities
      .map((entity: any) => {
        const type = entity.className;
        const offset = entity.offset ?? 0;
        const length = entity.length ?? 0;
        const extra = entity.url ?? entity.userId ?? '';
        return `${type}:${offset}:${length}:${extra}`;
      })
      .join('|');
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    attempt = 0,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= 2) {
        throw error;
      }

      const delayMs = 250 * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      await this.ensureConnected();
      return this.withRetry(operation, attempt + 1);
    }
  }

  private validateConfig(): void {

    if (!MTPROTO_MONITOR_CONFIG.API_ID) {
      throw new Error('MTPROTO_API_ID_MISSING');
    }

    if (!MTPROTO_MONITOR_CONFIG.API_HASH) {
      throw new Error('MTPROTO_API_HASH_MISSING');
    }

    if (!MTPROTO_MONITOR_CONFIG.SESSION) {
      throw new Error('MTPROTO_SESSION_MISSING');
    }
  }
}
