import {forwardRef, Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {DealEntity} from './entities/deal.entity';
import {DealCreativeEntity} from './entities/deal-creative.entity';
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
import {PaymentsModule} from '../payments/payments.module';
import {User} from '../auth/entities/user.entity';
import {DealsBotHandler} from './deals-bot.handler';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            DealEntity,
            DealCreativeEntity,
            DealReminderEntity,
            ListingEntity,
            ChannelEntity,
            ChannelMembershipEntity,
            User,
        ]),
        ChannelsModule,
        forwardRef(() => TelegramBotModule),
        WalletsModule,
        PaymentsModule,
    ],
    controllers: [DealsController],
    providers: [
        DealsService,
        DealsNotificationsService,
        DealsDeepLinkService,
        DealsTimeoutsService,
        DealsBotHandler,
    ],
    exports: [DealsService, DealsBotHandler],
})
export class DealsModule {}
