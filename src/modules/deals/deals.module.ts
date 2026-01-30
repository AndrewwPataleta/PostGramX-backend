import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {DealEntity} from './entities/deal.entity';
import {DealReminderEntity} from './entities/deal-reminder.entity';
import {ListingEntity} from '../listings/entities/listing.entity';
import {DealsService} from './deals.service';
import {DealsController} from './deals.controller';
import {ChannelEntity} from '../channels/entities/channel.entity';
import {ChannelMembershipEntity} from '../channels/entities/channel-membership.entity';
import {DealsNotificationsService} from './deals-notifications.service';
import {DealsDeepLinkService} from './deals-deep-link.service';
import {ChannelsModule} from '../channels/channels.module';
import {TelegramBotModule} from '../telegram-bot/telegram-bot.module';
import {DealsTimeoutsService} from './deals-timeouts.service';
import {WalletsModule} from '../payments/wallets/wallets.module';
import {User} from '../auth/entities/user.entity';
import {PaymentsModule} from '../payments/payments.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            DealEntity,
            DealReminderEntity,
            ListingEntity,
            ChannelEntity,
            ChannelMembershipEntity,
            User,
        ]),
        ChannelsModule,
        TelegramBotModule,
        WalletsModule,
        PaymentsModule,
    ],
    controllers: [DealsController],
    providers: [
        DealsService,
        DealsNotificationsService,
        DealsDeepLinkService,
        DealsTimeoutsService,
    ],
    exports: [DealsService],
})
export class DealsModule {}
