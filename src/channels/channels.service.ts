import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { ApiError } from "../common/errors/api-error";
import { normalizeChannelRef } from "../common/utils/normalize-channel-ref";
import { AppConfigService } from "../config/app-config.service";
import { TelegramApiService } from "../telegram/telegram-api.service";
import { ChannelAccessService } from "./channel-access.service";
import { LinkChannelDto } from "./dto/link-channel.dto";
import { ChannelManagerRole } from "./enums/channel-manager-role";
import { ChannelStatus } from "./enums/channel-status";
import {
  ChannelVerificationAttemptEntity,
  ChannelVerificationResult
} from "./entities/channel-verification-attempt.entity";
import { ChannelEntity } from "./entities/channel.entity";
import { ChannelManagerEntity } from "./entities/channel-manager.entity";

interface AdminEntry {
  user: { id: number; username?: string };
  can_post_messages?: boolean;
}

@Injectable()
export class ChannelsService {
  constructor(
    @InjectRepository(ChannelEntity)
    private readonly channelRepository: Repository<ChannelEntity>,
    @InjectRepository(ChannelManagerEntity)
    private readonly managerRepository: Repository<ChannelManagerEntity>,
    @InjectRepository(ChannelVerificationAttemptEntity)
    private readonly attemptRepository: Repository<ChannelVerificationAttemptEntity>,
    private readonly telegramApi: TelegramApiService,
    private readonly config: AppConfigService,
    private readonly accessService: ChannelAccessService
  ) {}

  async linkChannel(userId: string, body: LinkChannelDto) {
    if (!userId) {
      throw new ApiError(401, "FORBIDDEN", "Authentication required");
    }
    const normalized = normalizeChannelRef(body.usernameOrLink);
    if (!normalized.username) {
      throw new ApiError(400, "INVALID_CHANNEL_REF", "Invalid channel reference");
    }

    const existing = await this.channelRepository.findOne({
      where: { username: normalized.username }
    });

    if (existing) {
      const existingManager = await this.managerRepository.findOne({
        where: { channelId: existing.id, userId }
      });
      if (!existingManager) {
        throw new ApiError(409, "CHANNEL_ALREADY_LINKED", "Channel already linked");
      }

      return {
        channelId: existing.id,
        status: existing.status,
        botUsername: this.config.telegramBotUsername,
        instructions: "Add bot as admin and press Verify."
      };
    }

    const channel = this.channelRepository.create({
      username: normalized.username,
      status: ChannelStatus.PENDING,
      title: normalized.username
    });
    const savedChannel = await this.channelRepository.save(channel);

    const manager = this.managerRepository.create({
      channelId: savedChannel.id,
      userId,
      role: ChannelManagerRole.OWNER,
      isActive: true
    });
    await this.managerRepository.save(manager);

    return {
      channelId: savedChannel.id,
      status: savedChannel.status,
      botUsername: this.config.telegramBotUsername,
      instructions: "Add bot as admin and press Verify."
    };
  }

  async verifyChannel(userId: string, channelId: string) {
    if (!userId) {
      throw new ApiError(401, "FORBIDDEN", "Authentication required");
    }
    const channel = await this.channelRepository.findOne({ where: { id: channelId } });
    if (!channel) {
      throw new ApiError(404, "CHANNEL_NOT_FOUND", "Channel not found");
    }

    const manager = await this.managerRepository.findOne({
      where: { channelId: channel.id, userId, isActive: true }
    });
    if (!manager) {
      throw new ApiError(403, "NOT_A_MANAGER", "Not a channel manager");
    }

    if (!channel.telegramChatId && !channel.username) {
      throw new ApiError(400, "INVALID_CHANNEL_REF", "Channel reference missing");
    }

    const chatRef = channel.telegramChatId ?? `@${channel.username}`;
    let attemptResult = ChannelVerificationResult.FAIL;
    let attemptReason = "UNKNOWN";

    try {
      const chat = await this.telegramApi.getChat(chatRef);
      const admins = (await this.telegramApi.getChatAdministrators(chat.id)) as AdminEntry[];

      const botAdmin = admins.find(
        (admin) =>
          admin.user?.username?.toLowerCase() ===
          this.config.telegramBotUsername.replace(/^@/, "").toLowerCase()
      );
      if (!botAdmin) {
        throw new ApiError(403, "BOT_NOT_ADMIN", "Bot is not an admin");
      }

      const userAdmin = admins.find((admin) => String(admin.user?.id) === String(userId));
      if (!userAdmin) {
        throw new ApiError(403, "USER_NOT_ADMIN", "User is not an admin");
      }

      if (botAdmin.can_post_messages === false) {
        throw new ApiError(403, "BOT_NO_POST_RIGHTS", "Bot lacks post permissions");
      }

      const existingChat = await this.channelRepository.findOne({
        where: { telegramChatId: String(chat.id) }
      });
      if (existingChat && existingChat.id !== channel.id) {
        throw new ApiError(409, "CHANNEL_ALREADY_LINKED", "Channel already linked");
      }

      const memberCount = await this.telegramApi.getChatMemberCount(chat.id);

      channel.telegramChatId = String(chat.id);
      channel.title = chat.title ?? channel.title;
      channel.description = chat.description ?? null;
      channel.photoFileId = chat.photo?.small_file_id ?? chat.photo?.big_file_id ?? null;
      channel.memberCount = memberCount;
      channel.status = ChannelStatus.VERIFIED;
      channel.botAdminVerifiedAt = new Date();
      channel.lastStatsSyncAt = new Date();
      const updatedChannel = await this.channelRepository.save(channel);

      manager.rightsSnapshot = userAdmin as unknown as Record<string, unknown>;
      manager.lastRecheckAt = new Date();
      await this.managerRepository.save(manager);

      await this.accessService.recheckUserAdmin(updatedChannel.id, userId);
      await this.accessService.recheckBotAdmin(updatedChannel.id);

      attemptResult = ChannelVerificationResult.SUCCESS;
      attemptReason = "SUCCESS";

      return {
        channelId: updatedChannel.id,
        status: updatedChannel.status,
        telegramChatId: updatedChannel.telegramChatId,
        title: updatedChannel.title,
        username: updatedChannel.username,
        memberCount: updatedChannel.memberCount,
        verifiedAt: updatedChannel.botAdminVerifiedAt
      };
    } catch (error) {
      if (error instanceof ApiError) {
        attemptReason = error.code;
        throw error;
      }
      attemptReason = "TELEGRAM_ERROR";
      throw error;
    } finally {
      const attempt = this.attemptRepository.create({
        channelId: channel.id,
        userId,
        result: attemptResult,
        reasonCode: attemptReason
      });
      await this.attemptRepository.save(attempt);
    }
  }

  async getMyChannels(userId: string) {
    if (!userId) {
      throw new ApiError(401, "FORBIDDEN", "Authentication required");
    }
    const managers = await this.managerRepository.find({ where: { userId, isActive: true } });
    if (!managers.length) {
      return [];
    }

    const channelIds = managers.map((managerItem) => managerItem.channelId);
    const channels = await this.channelRepository.findBy({ id: In(channelIds) });

    return channels.map((channelItem) => ({
      id: channelItem.id,
      title: channelItem.title,
      username: channelItem.username,
      status: channelItem.status,
      memberCount: channelItem.memberCount,
      botAdminVerifiedAt: channelItem.botAdminVerifiedAt,
      lastStatsSyncAt: channelItem.lastStatsSyncAt,
      photoFileId: channelItem.photoFileId
    }));
  }

  async getChannel(userId: string, channelId: string) {
    if (!userId) {
      throw new ApiError(401, "FORBIDDEN", "Authentication required");
    }
    const channel = await this.channelRepository.findOne({ where: { id: channelId } });
    if (!channel) {
      throw new ApiError(404, "CHANNEL_NOT_FOUND", "Channel not found");
    }

    const manager = await this.managerRepository.findOne({
      where: { channelId, userId, isActive: true }
    });
    if (!manager) {
      throw new ApiError(403, "NOT_A_MANAGER", "Not a channel manager");
    }

    return {
      id: channel.id,
      title: channel.title,
      username: channel.username,
      description: channel.description,
      status: channel.status,
      memberCount: channel.memberCount,
      botAdminVerifiedAt: channel.botAdminVerifiedAt,
      lastAdminRecheckAt: channel.lastAdminRecheckAt,
      lastStatsSyncAt: channel.lastStatsSyncAt
    };
  }
}
