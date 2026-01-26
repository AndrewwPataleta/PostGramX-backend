import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {ChannelsController} from './channels.controller';
import {ChannelsService} from './channels.service';
import {ChannelEntity} from './entities/channel.entity';
import {ChannelMembershipEntity} from './entities/channel-membership.entity';
import {TelegramModule} from '../telegram/telegram.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([ChannelEntity, ChannelMembershipEntity]),
        TelegramModule,
    ],
    controllers: [ChannelsController],
    providers: [ChannelsService],
    exports: [ChannelsService],
})
export class ChannelsModule {}
