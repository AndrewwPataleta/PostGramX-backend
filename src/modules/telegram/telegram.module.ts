import {forwardRef, Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {I18nModule} from 'nestjs-i18n';
import {TelegramService} from './telegram.service';
import {TelegramChatService} from './telegram-chat.service';
import {User} from '../auth/entities/user.entity';
import {TelegramAdminsSyncService} from './telegram-admins-sync.service';
import {ChannelEntity} from '../channels/entities/channel.entity';
import {ChannelTelegramAdminEntity} from '../channels/entities/channel-telegram-admin.entity';
import {TelegramI18nService} from './i18n/telegram-i18n.service';
import {TelegramMessengerService} from './telegram-messenger.service';
import {TelegramBotModule} from '../telegram-bot/telegram-bot.module';

@Module({
    exports: [
        TelegramService,
        TelegramChatService,
        TelegramAdminsSyncService,
        TelegramI18nService,
        TelegramMessengerService,
    ],
    imports: [
        I18nModule,
        TypeOrmModule.forFeature([
            User,
            ChannelEntity,
            ChannelTelegramAdminEntity,
        ]),
        forwardRef(() => TelegramBotModule),
    ],
    providers: [
        TelegramService,
        TelegramChatService,
        TelegramAdminsSyncService,
        TelegramI18nService,
        TelegramMessengerService,
    ],
})
export class TelegramModule {}
