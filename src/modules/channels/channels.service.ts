import {ForbiddenException, Injectable, NotFoundException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {ChannelEntity} from './entities/channel.entity';
import {
    ChannelMembershipEntity,
    TelegramAdminStatus,
} from './entities/channel-membership.entity';
import {ChannelStatus} from './types/channel-status.enum';
import {ChannelRole} from './types/channel-role.enum';
import {ChannelErrorCode} from './types/channel-error-code.enum';
import {ListChannelsFilters} from './dto/list-channels.dto';
import {ChannelServiceError} from './errors/channel-service.error';
import {
    ChannelDetails,
    ChannelLinkResult,
    ChannelListResponse,
    ChannelPreview,
    ChannelVerifyResult,
} from './types/channel-service.types';
import {
    TelegramChatService,
    TelegramChatServiceError,
    TelegramChatErrorCode,
    TelegramChatMember,
} from '../telegram/telegram-chat.service';
import {mapChannelErrorToMessageKey} from './channel-error-mapper';

@Injectable()
export class ChannelsService {
    constructor(
        @InjectRepository(ChannelEntity)
        private readonly channelRepository: Repository<ChannelEntity>,
        @InjectRepository(ChannelMembershipEntity)
        private readonly membershipRepository: Repository<ChannelMembershipEntity>,
        private readonly telegramChatService: TelegramChatService,
    ) {}

    async previewChannel(usernameOrLink: string): Promise<ChannelPreview> {
        try {
            const normalizedUsername =
                this.telegramChatService.normalizeUsernameOrLink(
                    usernameOrLink,
                );
            const chat = await this.telegramChatService.getChatByUsername(
                normalizedUsername,
            );
            const publicChat = this.telegramChatService.assertPublicChannel(chat);
            const memberCount =
                await this.telegramChatService.getChatMemberCount(
                    publicChat.id ?? normalizedUsername,
                );

            let avatarUrl: string | null = null;
            if (publicChat.photo?.big_file_id) {
                const file = await this.telegramChatService.getFile(
                    publicChat.photo.big_file_id,
                );
                if (file.file_path) {
                    avatarUrl = this.telegramChatService.buildFileUrl(
                        file.file_path,
                    );
                }
            }

            return {
                normalizedUsername,
                title: publicChat.title ?? normalizedUsername,
                username: publicChat.username ?? normalizedUsername,
                telegramChatId: publicChat.id ?? null,
                type: 'channel',
                isPublic: true,
                nextStep: 'ADD_BOT_AS_ADMIN',
                memberCount,
                avatarUrl,
                description: publicChat.description ?? null,
            };
        } catch (error) {
            this.throwMappedError(error);
        }
    }

    async linkChannel(username: string, userId: string): Promise<ChannelLinkResult> {
        let normalizedUsername = username;
        try {
            normalizedUsername =
                this.telegramChatService.normalizeUsernameOrLink(username);
        } catch (error) {
            this.throwMappedError(error);
        }

        let channel = await this.channelRepository.findOne({
            where: {username: normalizedUsername},
        });

        if (!channel) {
            channel = this.channelRepository.create({
                username: normalizedUsername,
                title: normalizedUsername,
                status: ChannelStatus.PENDING_VERIFY,
                createdByUserId: userId,
            });
        } else {
            channel.status = ChannelStatus.PENDING_VERIFY;
        }

        await this.channelRepository.save(channel);

        await this.upsertMembership(channel.id, userId, ChannelRole.OWNER);

        return {channelId: channel.id, status: channel.status};
    }

    async verifyChannel(
        channelId: string,
        userId: string,
        telegramUserId?: string | null,
    ): Promise<ChannelVerifyResult> {
        const channel = await this.channelRepository.findOne({
            where: {id: channelId},
        });

        if (!channel) {
            throw new ChannelServiceError(
                ChannelErrorCode.CHANNEL_NOT_FOUND,
            );
        }

        try {
            const chat = await this.telegramChatService.getChatByUsername(
                channel.username,
            );
            const publicChat = this.telegramChatService.assertPublicChannel(chat);
            const admins =
                await this.telegramChatService.getChatAdministratorsByUsername(
                    channel.username,
                );

            const userAdmin = this.findUserAdmin(admins, telegramUserId);
            const {botAdmin} = await this.telegramChatService.extractBotAdmin(
                admins,
            );

            channel.title = publicChat.title ?? channel.title;
            channel.telegramChatId = String(publicChat.id);
            channel.status = ChannelStatus.VERIFIED;
            channel.verifiedAt = new Date();
            channel.lastCheckedAt = new Date();
            channel.verificationErrorCode = null;
            channel.verificationErrorMessage = null;

            await this.channelRepository.save(channel);

            const permissionsSnapshot = {
                user: this.buildAdminSnapshot(userAdmin),
                bot: this.buildAdminSnapshot(botAdmin),
            };

            await this.upsertMembership(
                channel.id,
                userId,
                ChannelRole.OWNER,
                userAdmin,
                permissionsSnapshot,
            );

            return {
                channelId: channel.id,
                status: channel.status,
                role: ChannelRole.OWNER,
                verifiedAt: channel.verifiedAt?.toISOString(),
                permissions: permissionsSnapshot,
            };
        } catch (error) {
            const mapped = this.mapError(error);
            if (mapped) {
                await this.markChannelFailed(
                    channel,
                    mapped.code,
                    mapChannelErrorToMessageKey(mapped.code),
                );
                throw mapped;
            }
            throw error;
        }
    }

    async listForUser(
        userId: string,
        filters: ListChannelsFilters,
    ): Promise<ChannelListResponse> {
        const page = filters.page ?? 1;
        const limit = Math.min(filters.limit ?? 20, 50);
        const offset = (page - 1) * limit;
        const sort = filters.sort ?? 'recent';
        const order = filters.order ?? 'desc';

        const query = this.channelRepository
            .createQueryBuilder('channel')
            .innerJoinAndMapOne(
                'channel.membership',
                ChannelMembershipEntity,
                'membership',
                'membership.channelId = channel.id AND membership.userId = :userId AND membership.isActive = true',
                {userId},
            )
            .select([
                'channel.id',
                'channel.username',
                'channel.title',
                'channel.status',
                'channel.telegramChatId',
                'channel.memberCount',
                'channel.avgViews',
                'channel.verifiedAt',
                'channel.lastCheckedAt',
                'channel.updatedAt',
            ])
            .addSelect([
                'membership.role',
                'membership.telegramAdminStatus',
                'membership.lastRecheckAt',
            ]);

        if (filters.role) {
            query.andWhere('membership.role = :role', {role: filters.role});
        }

        if (filters.status) {
            query.andWhere('channel.status = :status', {
                status: filters.status,
            });
        }

        if (filters.verifiedOnly) {
            query.andWhere('channel.status = :verifiedStatus', {
                verifiedStatus: ChannelStatus.VERIFIED,
            });
        }

        if (filters.username) {
            query.andWhere('channel.username = :username', {
                username: filters.username,
            });
        }

        if (filters.q) {
            query.andWhere(
                '(channel.title ILIKE :query OR channel.username ILIKE :query)',
                {query: `%${filters.q}%`},
            );
        }

        switch (sort) {
            case 'title':
                query.orderBy('channel.title', order.toUpperCase() as 'ASC' | 'DESC');
                query.addOrderBy('channel.id', 'DESC');
                break;
            case 'subscribers':
                query.orderBy('channel.memberCount', 'DESC', 'NULLS LAST');
                query.addOrderBy('channel.id', 'DESC');
                break;
            case 'recent':
            default:
                query.orderBy('channel.updatedAt', 'DESC');
                query.addOrderBy('channel.id', 'DESC');
                break;
        }

        query.skip(offset).take(limit);

        const [channels, total] = await query.getManyAndCount();

        const items = channels.map((channel) => {
            const membership = (channel as ChannelEntity & {
                membership: ChannelMembershipEntity;
            }).membership;

            return {
                id: channel.id,
                username: channel.username,
                title: channel.title,
                status: channel.status,
                telegramChatId: channel.telegramChatId,
                memberCount: channel.memberCount,
                avgViews: channel.avgViews,
                verifiedAt: channel.verifiedAt,
                lastCheckedAt: channel.lastCheckedAt,
                membership: {
                    role: membership.role,
                    telegramAdminStatus: membership.telegramAdminStatus,
                    lastRecheckAt: membership.lastRecheckAt,
                },
            };
        });

        const totalPages = limit > 0 ? Math.ceil(total / limit) : 0;

        return {
            items,
            page,
            limit,
            total,
            totalPages,
            hasPrev: page > 1,
            hasNext: page < totalPages,
        };
    }

    async getForUser(
        userId: string,
        channelId: string,
    ): Promise<ChannelDetails> {
        const channel = await this.channelRepository.findOne({
            where: {id: channelId},
        });

        if (!channel) {
            throw new NotFoundException('Channel not found.');
        }

        const membership = await this.membershipRepository.findOne({
            where: {channelId, userId, isActive: true},
        });

        if (!membership) {
            throw new ForbiddenException('Access denied.');
        }

        return {
            id: channel.id,
            username: channel.username,
            title: channel.title,
            status: channel.status,
            telegramChatId: channel.telegramChatId,
            memberCount: channel.memberCount,
            avgViews: channel.avgViews,
            verifiedAt: channel.verifiedAt,
            lastCheckedAt: channel.lastCheckedAt,
            languageStats: channel.languageStats,
            membership: {
                role: membership.role,
                telegramAdminStatus: membership.telegramAdminStatus,
                lastRecheckAt: membership.lastRecheckAt,
            },
        };
    }

    private findUserAdmin(
        admins: TelegramChatMember[],
        telegramUserId?: string | null,
    ): TelegramChatMember {
        const numericId = telegramUserId ? Number(telegramUserId) : NaN;
        const userAdmin = admins.find(
            (admin) => admin.user?.id === numericId,
        );

        if (!userAdmin) {
            throw new ChannelServiceError(
                ChannelErrorCode.USER_NOT_ADMIN,
            );
        }

        if (!['creator', 'administrator'].includes(userAdmin.status)) {
            throw new ChannelServiceError(
                ChannelErrorCode.USER_NOT_ADMIN,
            );
        }

        return userAdmin;
    }

    private buildAdminSnapshot(admin: TelegramChatMember) {
        return {
            status: admin.status,
            can_post_messages: admin.can_post_messages ?? false,
            can_edit_messages: admin.can_edit_messages ?? false,
            can_delete_messages: admin.can_delete_messages ?? false,
            can_manage_chat: admin.can_manage_chat ?? false,
            can_manage_video_chats: admin.can_manage_video_chats ?? false,
            can_change_info: admin.can_change_info ?? false,
            can_invite_users: admin.can_invite_users ?? false,
            can_pin_messages: admin.can_pin_messages ?? false,
            can_promote_members: admin.can_promote_members ?? false,
        };
    }

    private async upsertMembership(
        channelId: string,
        userId: string,
        role: ChannelRole,
        userAdmin?: TelegramChatMember,
        permissionsSnapshot?: Record<string, unknown>,
    ) {
        let membership = await this.membershipRepository.findOne({
            where: {channelId, userId},
        });

        if (!membership) {
            membership = this.membershipRepository.create({
                channelId,
                userId,
                role,
            });
        }

        membership.role = role;
        membership.isActive = true;
        membership.lastRecheckAt = new Date();

        if (userAdmin) {
            membership.telegramAdminStatus =
                userAdmin.status === 'creator'
                    ? TelegramAdminStatus.CREATOR
                    : TelegramAdminStatus.ADMINISTRATOR;
        }

        if (permissionsSnapshot) {
            membership.permissionsSnapshot = permissionsSnapshot;
        }

        await this.membershipRepository.save(membership);
    }

    private mapError(error: unknown): ChannelServiceError | null {
        if (error instanceof ChannelServiceError) {
            return error;
        }

        if (error instanceof TelegramChatServiceError) {
            return this.mapTelegramError(error);
        }

        return null;
    }

    private throwMappedError(error: unknown): never {
        const mapped = this.mapError(error);
        if (mapped) {
            throw mapped;
        }
        throw error;
    }

    private mapTelegramError(error: TelegramChatServiceError): ChannelServiceError {
        const mapping: Record<TelegramChatErrorCode, ChannelErrorCode> = {
            [TelegramChatErrorCode.CHANNEL_NOT_FOUND]:
                ChannelErrorCode.CHANNEL_NOT_FOUND,
            [TelegramChatErrorCode.BOT_FORBIDDEN]: ChannelErrorCode.BOT_FORBIDDEN,
            [TelegramChatErrorCode.NOT_A_CHANNEL]: ChannelErrorCode.NOT_A_CHANNEL,
            [TelegramChatErrorCode.CHANNEL_PRIVATE_OR_NO_USERNAME]:
                ChannelErrorCode.CHANNEL_PRIVATE_OR_NO_USERNAME,
            [TelegramChatErrorCode.BOT_NOT_ADMIN]: ChannelErrorCode.BOT_NOT_ADMIN,
            [TelegramChatErrorCode.BOT_MISSING_RIGHTS]:
                ChannelErrorCode.BOT_MISSING_RIGHTS,
            [TelegramChatErrorCode.INVALID_USERNAME]:
                ChannelErrorCode.INVALID_USERNAME,
        };

        const code = mapping[error.code] ?? ChannelErrorCode.CHANNEL_NOT_FOUND;
        return new ChannelServiceError(code);
    }

    private async markChannelFailed(
        channel: ChannelEntity,
        code: ChannelErrorCode,
        messageKey: string,
    ) {
        channel.status = ChannelStatus.FAILED;
        channel.verifiedAt = null;
        channel.lastCheckedAt = new Date();
        channel.verificationErrorCode = code;
        channel.verificationErrorMessage = messageKey;
        await this.channelRepository.save(channel);
    }

}
