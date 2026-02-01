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
import {TelegramModule} from '../telegram/telegram.module';
import {TelegramBotModuleInitService} from './telegram-bot.module-init.service';

@Module({
    imports: [
        ConfigModule,
        ChannelsModule,
        TypeOrmModule.forFeature([User]),
        DealsModule,
        // TelegramBotUpdate index [2] depends on TelegramMessengerService,
        // which is owned + exported by TelegramModule to keep boundaries clear.
        forwardRef(() => TelegramModule),
    ],
    providers: [
        TelegramBotService,
        TelegramBotUpdate,
        StartHandler,
        HelpHandler,
        TelegramBotModuleInitService,
    ],
    exports: [TelegramBotService],
})
export class TelegramBotModule {}
