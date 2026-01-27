import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {TelegramService} from './telegram.service';
import {TelegramChatService} from './telegram-chat.service';
import {User} from '../auth/entities/user.entity';
import {TelegramAdminsSyncService} from './telegram-admins-sync.service';
import {ChannelEntity} from '../channels/entities/channel.entity';
import {ChannelTelegramAdminEntity} from '../channels/entities/channel-telegram-admin.entity';

@Module({
    exports: [TelegramService, TelegramChatService, TelegramAdminsSyncService],
    imports: [
        TypeOrmModule.forFeature([
            User,
            ChannelEntity,
            ChannelTelegramAdminEntity,
        ]),
    ],
    providers: [TelegramService, TelegramChatService, TelegramAdminsSyncService],
})
export class TelegramModule {}
