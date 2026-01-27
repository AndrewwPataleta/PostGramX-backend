import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {ChannelsController} from './channels.controller';
import {ChannelsService} from './channels.service';
import {ChannelEntity} from './entities/channel.entity';
import {ChannelMembershipEntity} from './entities/channel-membership.entity';
import {TelegramModule} from '../telegram/telegram.module';
import {ChannelTelegramAdminEntity} from './entities/channel-telegram-admin.entity';
import {MembershipsAutoLinkService} from './memberships-auto-link.service';
import {ChannelAdminRecheckService} from './guards/channel-admin-recheck.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            ChannelEntity,
            ChannelMembershipEntity,
            ChannelTelegramAdminEntity,
        ]),
        TelegramModule,
    ],
    controllers: [ChannelsController],
    providers: [
        ChannelsService,
        MembershipsAutoLinkService,
        ChannelAdminRecheckService,
    ],
    exports: [ChannelsService, MembershipsAutoLinkService],
})
export class ChannelsModule {}
