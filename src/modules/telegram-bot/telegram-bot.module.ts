import {forwardRef, Module} from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';
import {TypeOrmModule} from '@nestjs/typeorm';
import {HelpHandler} from './handlers/help.handler';
import {StartHandler} from './handlers/start.handler';
import {TelegramBotService} from './telegram-bot.service';
import {TelegramBotUpdate} from './telegram-bot.update';
import {DealsModule} from '../deals/deals.module';
import {ChannelsModule} from '../channels/channels.module';

import {User} from '../auth/entities/user.entity';
import {TelegramI18nService} from "../telegram/i18n/telegram-i18n.service";
import {TelegramMessengerService} from "../telegram/telegram-messenger.service";

@Module({
    imports: [
        ConfigModule,
        ChannelsModule,
        TypeOrmModule.forFeature([User]),
        forwardRef(() => DealsModule),
    ],
    providers: [
        TelegramBotService,
        TelegramBotUpdate,
        StartHandler,
        HelpHandler,
        TelegramI18nService,
        TelegramMessengerService,
    ],
    exports: [TelegramBotService, TelegramI18nService, TelegramMessengerService],
})
export class TelegramBotModule {}
