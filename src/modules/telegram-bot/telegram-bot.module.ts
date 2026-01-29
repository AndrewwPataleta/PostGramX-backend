import {forwardRef, Module} from '@nestjs/common';
import {ConfigModule} from '@nestjs/config';
import {HelpHandler} from './handlers/help.handler';
import {StartHandler} from './handlers/start.handler';
import {TelegramBotService} from './telegram-bot.service';
import {TelegramBotUpdate} from './telegram-bot.update';
import {PreDealsModule} from '../predeals/predeals.module';

@Module({
    imports: [ConfigModule, forwardRef(() => PreDealsModule)],
    providers: [
        TelegramBotService,
        TelegramBotUpdate,
        StartHandler,
        HelpHandler,
    ],
    exports: [TelegramBotService],
})
export class TelegramBotModule {}
