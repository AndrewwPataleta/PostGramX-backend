import {forwardRef, Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {DealEntity} from './entities/deal.entity';
import {DealCreativeEntity} from './entities/deal-creative.entity';
import {DealEscrowEntity} from './entities/deal-escrow.entity';
import {DealPublicationEntity} from './entities/deal-publication.entity';
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
import {TransactionEntity} from '../payments/entities/transaction.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            DealEntity,
            DealCreativeEntity,
            DealEscrowEntity,
            DealPublicationEntity,
            ListingEntity,
            ChannelEntity,
            ChannelMembershipEntity,
            User,
            TransactionEntity,
        ]),
        ChannelsModule,
        forwardRef(() => TelegramBotModule),
        WalletsModule,
        forwardRef(() => PaymentsModule),
    ],
    controllers: [DealsController],
    providers: [
        DealsService,
        DealsNotificationsService,
        DealsDeepLinkService,
        DealsTimeoutsService,
        DealsBotHandler,
    ],
    exports: [DealsService, DealsBotHandler, DealsNotificationsService],
})
export class DealsModule {}
