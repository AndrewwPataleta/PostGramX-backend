import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {ServiceError} from '../../core/service-error';
import {ChannelEntity} from '../channels/entities/channel.entity';
import {
    ChannelTelegramAdminEntity,
    TelegramAdminRole,
} from '../channels/entities/channel-telegram-admin.entity';
import {
    TelegramChatErrorCode,
    TelegramChatMember,
    TelegramChatService,
    TelegramChatServiceError,
} from './telegram-chat.service';

export enum TelegramAdminsSyncErrorCode {
    CHANNEL_NOT_FOUND = 'CHANNEL_NOT_FOUND',
    BOT_FORBIDDEN = 'BOT_FORBIDDEN',
}

export class TelegramAdminsSyncError extends ServiceError<TelegramAdminsSyncErrorCode> {
    constructor(code: TelegramAdminsSyncErrorCode) {
        super(code);
    }
}

@Injectable()
export class TelegramAdminsSyncService {
    constructor(
        private readonly telegramChatService: TelegramChatService,
        @InjectRepository(ChannelEntity)
        private readonly channelRepository: Repository<ChannelEntity>,
        @InjectRepository(ChannelTelegramAdminEntity)
        private readonly adminRepository: Repository<ChannelTelegramAdminEntity>,
    ) {}

    async syncChannelAdmins(channelId: string): Promise<void> {
        const channel = await this.channelRepository.findOne({where: {id: channelId}});

        if (!channel || !channel.telegramChatId) {
            throw new TelegramAdminsSyncError(
                TelegramAdminsSyncErrorCode.CHANNEL_NOT_FOUND,
            );
        }

        let admins: TelegramChatMember[];
        try {
            admins = await this.telegramChatService.getChatAdministrators(
                channel.telegramChatId,
            );
        } catch (error) {
            throw this.mapTelegramError(error);
        }

        const now = new Date();
        const mappedAdmins = admins
            .filter((admin) => !admin.user?.is_bot)
            .map((admin) => ({
                channelId: channel.id,
                telegramUserId: String(admin.user?.id),
                username: admin.user?.username ?? null,
                firstName: admin.user?.first_name ?? null,
                lastName: admin.user?.last_name ?? null,
                isBot: false,
                telegramRole:
                    admin.status === 'creator'
                        ? TelegramAdminRole.CREATOR
                        : TelegramAdminRole.ADMINISTRATOR,
                rights: this.buildRightsSnapshot(admin),
                isActive: true,
                lastSeenAt: now,
            }));

        if (mappedAdmins.length > 0) {
            await this.adminRepository.upsert(mappedAdmins, [
                'channelId',
                'telegramUserId',
            ]);
        }

        const activeIds = mappedAdmins.map((admin) => admin.telegramUserId);

        if (activeIds.length > 0) {
            await this.adminRepository
                .createQueryBuilder()
                .update(ChannelTelegramAdminEntity)
                .set({isActive: false, updatedAt: now})
                .where('channelId = :channelId', {channelId: channel.id})
                .andWhere('telegramUserId NOT IN (:...activeIds)', {activeIds})
                .execute();
        } else {
            await this.adminRepository
                .createQueryBuilder()
                .update(ChannelTelegramAdminEntity)
                .set({isActive: false, updatedAt: now})
                .where('channelId = :channelId', {channelId: channel.id})
                .execute();
        }
    }

    private mapTelegramError(error: unknown): TelegramAdminsSyncError | unknown {
        if (!(error instanceof TelegramChatServiceError)) {
            return error;
        }

        if (error.code === TelegramChatErrorCode.BOT_FORBIDDEN) {
            return new TelegramAdminsSyncError(
                TelegramAdminsSyncErrorCode.BOT_FORBIDDEN,
            );
        }

        if (error.code === TelegramChatErrorCode.CHANNEL_NOT_FOUND) {
            return new TelegramAdminsSyncError(
                TelegramAdminsSyncErrorCode.CHANNEL_NOT_FOUND,
            );
        }

        return new TelegramAdminsSyncError(
            TelegramAdminsSyncErrorCode.BOT_FORBIDDEN,
        );
    }

    private buildRightsSnapshot(admin: TelegramChatMember) {
        return {
            can_post_messages: admin.can_post_messages ?? false,
            can_edit_messages: admin.can_edit_messages ?? false,
            can_delete_messages: admin.can_delete_messages ?? false,
            can_invite_users: admin.can_invite_users ?? false,
            can_promote_members: admin.can_promote_members ?? false,
        };
    }
}
