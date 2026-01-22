import { Injectable, OnModuleInit } from "@nestjs/common";
import { Markup, Telegraf } from "telegraf";
import { AppConfigService } from "../config/app-config.service";

@Injectable()
export class TelegramBotService implements OnModuleInit {
  private bot: Telegraf;

  constructor(private readonly config: AppConfigService) {
    this.bot = new Telegraf(this.config.telegramBotToken);
  }

  onModuleInit() {
    this.bot.start((ctx) => {
      const buttons = this.config.appPublicUrl
        ? Markup.inlineKeyboard([Markup.button.url("Open Mini App", this.config.appPublicUrl)])
        : undefined;
      const reply =
        "Welcome! Use the app to link your channel, add this bot as an admin, then press Verify.";
      if (buttons) {
        ctx.reply(reply, buttons);
        return;
      }
      ctx.reply(reply);
    });

    this.bot.launch();
  }
}
