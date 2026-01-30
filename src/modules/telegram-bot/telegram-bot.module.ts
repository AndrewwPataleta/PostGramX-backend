import {forwardRef, Module} from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';
import {HelpHandler} from './handlers/help.handler';
import {StartHandler} from './handlers/start.handler';
import {TelegramBotService} from './telegram-bot.service';
import {TelegramBotUpdate} from './telegram-bot.update';
import {DealsModule} from '../deals/deals.module';
import {ChannelsModule} from '../channels/channels.module';

@Module({
    imports: [ConfigModule, ChannelsModule, forwardRef(() => DealsModule)],
    providers: [
        TelegramBotService,
        TelegramBotUpdate,
        StartHandler,
        HelpHandler,
    ],
    exports: [TelegramBotService],
})
export class TelegramBotModule {}
