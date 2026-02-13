import { Injectable, Logger } from '@nestjs/common';
import { MTPROTO_MONITOR_CONFIG } from '../mtproto-monitor.config';

export interface MtprotoChannelMessage {
  id: number;
  text: string | null;
  mediaUniqueId: string | null;
  entitiesSignature: string | null;
}

@Injectable()
export class MtprotoClientService {
  private readonly logger = new Logger(MtprotoClientService.name);
  private readonly gatewayUrl = process.env.MTPROTO_GATEWAY_URL ?? '';
  private circuitOpenedUntil = 0;

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
    return this.withRetry(async () =>
      this.request<MtprotoChannelMessage | null>('channel-message', {
        peer,
        messageId,
      }),
    );
  }

  async getPinnedMessage(peer: string): Promise<number | null> {
    return this.withRetry(async () =>
      this.request<number | null>('channel-pinned-message', { peer }),
    );
  }

  async getChannelHistorySlice(
    peer: string,
    aroundMessageId: number,
  ): Promise<MtprotoChannelMessage[]> {
    return this.withRetry(async () =>
      this.request<MtprotoChannelMessage[]>('channel-history-slice', {
        peer,
        aroundMessageId,
      }),
    );
  }

  private async withRetry<T>(
    operation: () => Promise<T>,
    attempt = 0,
  ): Promise<T> {
    if (!this.gatewayUrl) {
      throw new Error('MTPROTO_GATEWAY_URL_MISSING');
    }

    if (Date.now() < this.circuitOpenedUntil) {
      throw new Error('MTPROTO_CIRCUIT_OPEN');
    }

    try {
      return await operation();
    } catch (error) {
      if (attempt >= 2) {
        this.circuitOpenedUntil = Date.now() + 30_000;
        this.logger.warn('MTProto circuit opened for 30 seconds');
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      return this.withRetry(operation, attempt + 1);
    }
  }

  private async request<T>(
    endpoint: string,
    payload: Record<string, unknown>,
  ): Promise<T> {
    const response = await fetch(`${this.gatewayUrl}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-mtproto-api-id': String(MTPROTO_MONITOR_CONFIG.API_ID),
        'x-mtproto-api-hash': MTPROTO_MONITOR_CONFIG.API_HASH,
        'x-mtproto-session': MTPROTO_MONITOR_CONFIG.SESSION,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`MTPROTO_HTTP_${response.status}`);
    }

    const result = (await response.json()) as { ok: boolean; result?: T };
    if (!result.ok) {
      throw new Error('MTPROTO_REQUEST_FAILED');
    }

    return result.result as T;
  }
}
