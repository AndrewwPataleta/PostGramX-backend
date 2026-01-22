import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ApiError } from "../common/errors/api-error";
import { AppConfigService } from "../config/app-config.service";
import { TelegramApiService } from "../telegram/telegram-api.service";
import { ChannelEntity } from "./entities/channel.entity";
import { ChannelManagerEntity } from "./entities/channel-manager.entity";

@Injectable()
export class ChannelAccessService {
  constructor(
    @InjectRepository(ChannelEntity)
    private readonly channelRepository: Repository<ChannelEntity>,
    @InjectRepository(ChannelManagerEntity)
    private readonly managerRepository: Repository<ChannelManagerEntity>,
    private readonly telegramApi: TelegramApiService,
    private readonly config: AppConfigService
  ) {}

  async recheckUserAdmin(channelId: string, userId: string) {
    const channel = await this.channelRepository.findOne({ where: { id: channelId } });
    if (!channel?.telegramChatId) {
      throw new ApiError(404, "CHANNEL_NOT_FOUND", "Channel not found");
    }

    const admins = await this.telegramApi.getChatAdministrators(channel.telegramChatId);
    const userAdmin = admins.find((admin: any) => String(admin.user?.id) === String(userId));
    if (!userAdmin) {
      throw new ApiError(403, "USER_ADMIN_REVOKED", "User is no longer an admin");
    }

    await this.managerRepository.update({ channelId, userId }, { lastRecheckAt: new Date() });
    return userAdmin;
  }

  async recheckBotAdmin(channelId: string) {
    const channel = await this.channelRepository.findOne({ where: { id: channelId } });
    if (!channel?.telegramChatId) {
      throw new ApiError(404, "CHANNEL_NOT_FOUND", "Channel not found");
    }

    const admins = await this.telegramApi.getChatAdministrators(channel.telegramChatId);
    const botAdmin = admins.find(
      (admin: any) =>
        admin.user?.username?.toLowerCase() === this.config.telegramBotUsername.slice(1).toLowerCase()
    );
    if (!botAdmin) {
      throw new ApiError(403, "BOT_ADMIN_REVOKED", "Bot is no longer an admin");
    }

    if (botAdmin?.can_post_messages === false) {
      throw new ApiError(403, "BOT_ADMIN_REVOKED", "Bot lacks post permissions");
    }

    await this.channelRepository.update({ id: channelId }, { lastAdminRecheckAt: new Date() });
    return botAdmin;
  }
}
