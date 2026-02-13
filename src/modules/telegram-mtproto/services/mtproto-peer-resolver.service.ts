import { Injectable } from '@nestjs/common';
import { ChannelEntity } from '../../channels/entities/channel.entity';
import { MTPROTO_MONITOR_CONFIG } from '../mtproto-monitor.config';

interface CachedPeer {
  expiresAt: number;
  peer: string;
}

@Injectable()
export class MtprotoPeerResolverService {
  private readonly cache = new Map<string, CachedPeer>();

  async resolveChannelPeer(channel: ChannelEntity): Promise<string | null> {
    const cacheKey = channel.id;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.peer;
    }

    const candidate =
      channel.telegramChatId ??
      (channel.username ? `@${channel.username}` : null);
    if (!candidate) {
      return null;
    }

    this.cache.set(cacheKey, {
      peer: candidate,
      expiresAt:
        Date.now() + MTPROTO_MONITOR_CONFIG.PEER_CACHE_MINUTES * 60 * 1000,
    });

    return candidate;
  }
}
