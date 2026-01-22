import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppConfigService } from "./config/app-config.service";
import { ConfigModule } from "./config/config.module";
import { ChannelsModule } from "./channels/channels.module";
import { TelegramModule } from "./telegram/telegram.module";

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        type: "postgres",
        url: config.databaseUrl,
        synchronize: false,
        logging: false,
        autoLoadEntities: true
      })
    }),
    TelegramModule,
    ChannelsModule
  ]
})
export class AppModule {}
