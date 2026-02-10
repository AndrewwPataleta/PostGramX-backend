import {Controller, ForbiddenException, Get, Param, Req} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {Request} from 'express';
import {ChannelEntity} from '../../channels/entities/channel.entity';
import {ChannelMembershipEntity} from '../../channels/entities/channel-membership.entity';
import {ChannelAnalyticsEntity} from '../entities/channel-analytics.entity';
import {assertUser} from '../../../core/controller-utils';

@Controller('channels')
export class ChannelAnalyticsController {
    constructor(
        @InjectRepository(ChannelEntity)
        private readonly channelRepository: Repository<ChannelEntity>,
        @InjectRepository(ChannelMembershipEntity)
        private readonly membershipRepository: Repository<ChannelMembershipEntity>,
        @InjectRepository(ChannelAnalyticsEntity)
        private readonly analyticsRepository: Repository<ChannelAnalyticsEntity>,
    ) {}

    @Get(':id/analytics')
    async getAnalytics(@Param('id') id: string, @Req() req: Request) {
        const user = assertUser(req);
        await this.ensureMembership(id, user.id);

        const analytics = await this.analyticsRepository.find({
            where: {channelId: id},
            order: {collectedAt: 'DESC'},
            take: 30,
        });

        return {
            items: analytics.map((row) => ({
                collectedAt: row.collectedAt,
                subscribersCount: row.subscribersCount,
                avgViews: row.avgViews,
            })),
        };
    }

    @Get(':id/posts/preview')
    async getPostsPreview(@Param('id') id: string, @Req() req: Request) {
        const user = assertUser(req);
        await this.ensureMembership(id, user.id);

        const channel = await this.channelRepository.findOne({where: {id}});
        return {items: channel?.lastPostsPreview ?? []};
    }

    private async ensureMembership(channelId: string, userId: string) {
        const membership = await this.membershipRepository.findOne({
            where: {channelId, userId, isActive: true, isManuallyDisabled: false},
        });

        if (!membership) {
            throw new ForbiddenException('Access denied.');
        }
    }
}
