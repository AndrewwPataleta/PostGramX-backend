import {Injectable} from '@nestjs/common';
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
import {
    TelegramChatService,
    TelegramChatServiceError,
    TelegramChatErrorCode,
    TelegramChatMember,
} from '../telegram/telegram-chat.service';

export class ChannelServiceError extends Error {
    constructor(public readonly code: ChannelErrorCode) {
        super(code);
    }
}

export type ChannelPreview = {
    normalizedUsername: string;
    title: string;
    username: string;
    telegramChatId: number | null;
    type: 'channel';
    isPublic: true;
    nextStep: 'ADD_BOT_AS_ADMIN';
};

export type ChannelLinkResult = {
    channelId: string;
    status: ChannelStatus;
};

export type ChannelVerifyResult = {
    channelId: string;
    status: ChannelStatus;
    role: ChannelRole;
    verifiedAt?: string;
    error?: {code: ChannelErrorCode; message: string};
    permissions?: Record<string, unknown>;
};

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

            return {
                normalizedUsername,
                title: publicChat.title ?? normalizedUsername,
                username: publicChat.username ?? normalizedUsername,
                telegramChatId: publicChat.id ?? null,
                type: 'channel',
                isPublic: true,
                nextStep: 'ADD_BOT_AS_ADMIN',
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
                    this.getMessageKey(mapped.code),
                );
                throw mapped;
            }
            throw error;
        }
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

    private getMessageKey(code: ChannelErrorCode): string {
        switch (code) {
            case ChannelErrorCode.INVALID_USERNAME:
                return 'channels.errors.invalid_username';
            case ChannelErrorCode.CHANNEL_NOT_FOUND:
                return 'channels.errors.channel_not_found';
            case ChannelErrorCode.NOT_A_CHANNEL:
                return 'channels.errors.not_a_channel';
            case ChannelErrorCode.CHANNEL_PRIVATE_OR_NO_USERNAME:
                return 'channels.errors.channel_private_or_no_username';
            case ChannelErrorCode.BOT_FORBIDDEN:
                return 'channels.errors.bot_forbidden';
            case ChannelErrorCode.USER_NOT_ADMIN:
                return 'channels.errors.user_not_admin';
            case ChannelErrorCode.BOT_NOT_ADMIN:
                return 'channels.errors.bot_not_admin';
            case ChannelErrorCode.BOT_MISSING_RIGHTS:
                return 'channels.errors.bot_missing_rights';
            default:
                return 'channels.errors.channel_not_found';
        }
    }
}
