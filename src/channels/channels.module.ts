import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "../auth/auth.module";
import { ConfigModule } from "../config/config.module";

import { ChannelAccessService } from "./channel-access.service";
import { ChannelsController } from "./channels.controller";
import { ChannelsService } from "./channels.service";
import { ChannelVerificationAttemptEntity } from "./entities/channel-verification-attempt.entity";
import { ChannelEntity } from "./entities/channel.entity";
import { ChannelManagerEntity } from "./entities/channel-manager.entity";
import { TelegramModule } from '../modules/telegram/telegram.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ChannelEntity, ChannelManagerEntity, ChannelVerificationAttemptEntity]),
    ConfigModule,
    TelegramModule,
    AuthModule
  ],
  providers: [ChannelsService, ChannelAccessService],
  controllers: [ChannelsController]
})
export class ChannelsModule {}
