import { Module } from "@nestjs/common";
import { ConfigModule } from "../config/config.module";
import { TelegramApiService } from "./telegram-api.service";
import { TelegramBotService } from "./telegram-bot.service";

@Module({
  imports: [ConfigModule],
  providers: [TelegramApiService, TelegramBotService],
  exports: [TelegramApiService]
})
export class TelegramModule {}
