import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {ChannelEntity} from '../../channels/entities/channel.entity';
import {ChannelAnalyticsEntity} from '../entities/channel-analytics.entity';
import {MtprotoClient} from '../types/mtproto-client.interface';
import {MtprotoAnalyticsConfigService} from './mtproto-analytics-config.service';

@Injectable()
export class ChannelAnalyticsCollectorService {
    constructor(
        @InjectRepository(ChannelAnalyticsEntity)
        private readonly analyticsRepository: Repository<ChannelAnalyticsEntity>,
        @InjectRepository(ChannelEntity)
        private readonly channelRepository: Repository<ChannelEntity>,
        private readonly configService: MtprotoAnalyticsConfigService,
    ) {}

    async collectForChannel(
        channel: ChannelEntity,
        client: MtprotoClient,
    ): Promise<void> {
        const reference = this.resolveChannelReference(channel);
        if (!reference) {
            return;
        }

        const collectedAt = new Date();
        const {subscribersCount} = await client.getChannelFull(reference);
        const limit = Math.max(
            this.configService.postsSampleSize,
            this.configService.lastPostsLimit,
        );
        const posts = await client.getRecentPosts(reference, limit);

        const preview = posts.slice(0, this.configService.lastPostsLimit).map(
            (post) => ({
                id: post.id,
                date: post.date,
                text: post.text ?? '',
                views: post.views ?? null,
                forwards: post.forwards ?? null,
                replyCount: post.replies ?? null,
                link: this.buildPostLink(channel, post.id),
            }),
        );

        const sample = posts.slice(0, this.configService.postsSampleSize);
        const avgViews = this.computeAverage(sample, (post) => post.views);
        const avgForwards = this.computeAverage(sample, (post) => post.forwards);

        const analytics = this.analyticsRepository.create({
            channelId: channel.id,
            collectedAt,
            subscribersCount: subscribersCount ?? null,
            avgViews,
            avgForwards,
            avgReactions: null,
            postsSampleSize: this.configService.postsSampleSize,
            lastPostId: posts[0]?.id ?? null,
            lastPostsPreview: preview,
            rawMeta: null,
        });

        await this.analyticsRepository.save(analytics);

        await this.channelRepository.update(channel.id, {
            subscribersCount: subscribersCount ?? null,
            avgViews,
            lastPostsPreview: preview,
            analyticsUpdatedAt: collectedAt,
            mtprotoLastErrorCode: null,
            mtprotoLastErrorMessage: null,
            mtprotoLastErrorAt: null,
        });
    }

    private resolveChannelReference(channel: ChannelEntity): string | null {
        if (channel.telegramChatId) {
            return channel.telegramChatId;
        }
        if (channel.username) {
            return channel.username;
        }
        return null;
    }

    private computeAverage(
        posts: Array<{views?: number; forwards?: number}>,
        getter: (post: {views?: number; forwards?: number}) => number | undefined,
    ): number | null {
        const values = posts
            .map(getter)
            .filter((value): value is number =>
                value !== undefined && Number.isFinite(value),
            );
        if (values.length === 0) {
            return null;
        }
        const total = values.reduce((sum, value) => sum + value, 0);
        return Math.round(total / values.length);
    }

    private buildPostLink(channel: ChannelEntity, postId: string): string | null {
        if (!channel.username) {
            return null;
        }
        return `https://t.me/${channel.username}/${postId}`;
    }
}
