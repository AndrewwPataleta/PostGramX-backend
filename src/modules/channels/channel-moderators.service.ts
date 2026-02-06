import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {In, Repository} from 'typeorm';
import {ChannelEntity} from './entities/channel.entity';
import {ChannelMembershipEntity} from './entities/channel-membership.entity';
import {ChannelRole} from './types/channel-role.enum';
import {User} from '../auth/entities/user.entity';
import {ChannelAdminRecheckService} from './guards/channel-admin-recheck.service';
import {ChannelErrorCode} from './types/channel-error-code.enum';
import {ChannelServiceError} from './errors/channel-service.error';

export type ChannelModeratorItem = {
    userId: string;
    role: ChannelRole.OWNER | ChannelRole.MODERATOR;
    isActive: boolean;
    isManuallyDisabled: boolean;
    canReviewDeals: boolean;
    telegramAdminStatus?: string | null;
    displayName: string;
    username?: string | null;
    avatar?: string | null;
    lastRecheckAt?: string | null;
};

@Injectable()
export class ChannelModeratorsService {
    constructor(
        @InjectRepository(ChannelEntity)
        private readonly channelRepository: Repository<ChannelEntity>,
        @InjectRepository(ChannelMembershipEntity)
        private readonly membershipRepository: Repository<ChannelMembershipEntity>,
        @InjectRepository(User)
        private readonly userRepository: Repository<User>,
        private readonly channelAdminRecheckService: ChannelAdminRecheckService,
    ) {}

    async listModerators(
        channelId: string,
        userId: string,
    ): Promise<{
        channel: {id: string; username: string; title: string; ownerUserId: string};
        items: ChannelModeratorItem[];
    }> {
        const channel = await this.channelRepository.findOne({where: {id: channelId}});
        if (!channel) {
            throw new NotFoundException('Channel not found.');
        }

        const accessMembership = await this.membershipRepository.findOne({
            where: {channelId, userId, isActive: true, isManuallyDisabled: false},
        });

        if (
            !accessMembership ||
            ![ChannelRole.OWNER, ChannelRole.MODERATOR].includes(accessMembership.role)
        ) {
            throw new ForbiddenException('Access denied.');
        }

        const memberships = await this.membershipRepository.find({
            where: {
                channelId,
                role: In([ChannelRole.OWNER, ChannelRole.MODERATOR]),
            },
        });

        const userIds = memberships.map((membership) => membership.userId);
        const users = userIds.length
            ? await this.userRepository.find({where: {id: In(userIds)}})
            : [];
        const userMap = new Map(users.map((user) => [user.id, user]));

        const items = memberships.map((membership) =>
            this.mapMembershipToModeratorItem(
                membership,
                userMap.get(membership.userId),
            ),
        );

        items.sort((left, right) => {
            if (left.role !== right.role) {
                return left.role === ChannelRole.OWNER ? -1 : 1;
            }
            return left.displayName.localeCompare(right.displayName);
        });

        return {
            channel: {
                id: channel.id,
                username: channel.username,
                title: channel.title,
                ownerUserId: channel.ownerUserId,
            },
            items,
        };
    }

    async setReviewEnabled(
        channelId: string,
        userId: string,
        targetUserId: string,
        canReviewDeals: boolean,
    ): Promise<ChannelModeratorItem> {
        await this.requireChannelOwner(channelId, userId);

        const membership = await this.membershipRepository.findOne({
            where: {channelId, userId: targetUserId},
        });

        if (!membership) {
            throw new NotFoundException('Membership not found.');
        }

        const channel = await this.channelRepository.findOne({where: {id: channelId}});
        if (!channel) {
            throw new NotFoundException('Channel not found.');
        }

        if (channel.ownerUserId === membership.userId && !canReviewDeals) {
            throw new BadRequestException('Owner review permission cannot be disabled.');
        }

        membership.canReviewDeals = canReviewDeals;
        const saved = await this.membershipRepository.save(membership);

        const user = await this.userRepository.findOne({
            where: {id: saved.userId},
        });

        return this.mapMembershipToModeratorItem(saved, user);
    }

    async requireChannelOwner(
        channelId: string,
        userId: string,
    ): Promise<void> {
        const channel = await this.channelRepository.findOne({where: {id: channelId}});
        if (!channel) {
            throw new NotFoundException('Channel not found.');
        }

        if (channel.ownerUserId !== userId) {
            throw new ForbiddenException('Access denied.');
        }

        const membership = await this.membershipRepository.findOne({
            where: {channelId, userId, isActive: true, isManuallyDisabled: false},
        });

        if (!membership || membership.role !== ChannelRole.OWNER) {
            throw new ForbiddenException('Access denied.');
        }
    }

    async requireCanReviewDeals(
        channelId: string,
        userId: string,
        telegramUserId?: string | number | null,
    ): Promise<void> {
        const channel = await this.channelRepository.findOne({where: {id: channelId}});
        if (!channel) {
            throw new ChannelServiceError(ChannelErrorCode.CHANNEL_NOT_FOUND);
        }

        const membership = await this.membershipRepository.findOne({
            where: {channelId, userId},
        });

        if (!membership) {
            throw new ChannelServiceError(ChannelErrorCode.USER_NOT_MEMBER);
        }

        if (membership.isManuallyDisabled) {
            throw new ChannelServiceError(ChannelErrorCode.MEMBERSHIP_DISABLED);
        }

        if (!membership.isActive) {
            throw new ChannelServiceError(ChannelErrorCode.MEMBERSHIP_INACTIVE);
        }

        if (![ChannelRole.OWNER, ChannelRole.MODERATOR].includes(membership.role)) {
            throw new ChannelServiceError(ChannelErrorCode.USER_NOT_ADMIN);
        }

        if (!membership.canReviewDeals) {
            throw new ChannelServiceError(ChannelErrorCode.USER_NOT_ADMIN);
        }

        if (!telegramUserId) {
            throw new ChannelServiceError(ChannelErrorCode.USER_NOT_ADMIN);
        }

        await this.channelAdminRecheckService.requireChannelRights({
            channelId,
            userId,
            telegramId: Number(telegramUserId),
            required: {anyAdmin: true, allowManager: true},
        });
    }

    private mapMembershipToModeratorItem(
        membership: ChannelMembershipEntity,
        user?: User,
    ): ChannelModeratorItem {
        return {
            userId: membership.userId,
            role: membership.role as ChannelRole.OWNER | ChannelRole.MODERATOR,
            isActive: membership.isActive,
            isManuallyDisabled: membership.isManuallyDisabled,
            canReviewDeals: membership.canReviewDeals,
            telegramAdminStatus: membership.telegramAdminStatus ?? null,
            displayName: this.resolveDisplayName(user),
            username: user?.username ?? null,
            avatar: user?.avatar ?? null,
            lastRecheckAt: membership.lastRecheckAt
                ? membership.lastRecheckAt.toISOString()
                : null,
        };
    }

    private resolveDisplayName(user?: User): string {
        if (!user) {
            return 'Unknown';
        }
        const fullName = [user.firstName, user.lastName]
            .filter((value) => Boolean(value))
            .join(' ')
            .trim();
        if (fullName) {
            return fullName;
        }
        if (user.username) {
            return user.username;
        }
        return 'Unknown';
    }
}
