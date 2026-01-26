import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {TelegramService} from './telegram.service';
import {TelegramChatService} from './telegram-chat.service';
import {User} from '../auth/entities/user.entity';

@Module({
    exports: [TelegramService, TelegramChatService],
    imports: [
        TypeOrmModule.forFeature([
            User,
        ]),
    ],
    providers: [TelegramService, TelegramChatService],
})
export class TelegramModule {}
