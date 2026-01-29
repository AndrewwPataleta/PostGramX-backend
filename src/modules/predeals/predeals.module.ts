import {forwardRef, Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {PreDealsService} from './predeals.service';
import {PreDealsController} from './predeals.controller';
import {PreDealEntity} from './entities/pre-deal.entity';
import {PreDealCreativeEntity} from './entities/pre-deal-creative.entity';
import {PreDealParticipantEntity} from './entities/pre-deal-participant.entity';
import {ListingEntity} from '../listings/entities/listing.entity';
import {ChannelEntity} from '../channels/entities/channel.entity';
import {ChannelMembershipEntity} from '../channels/entities/channel-membership.entity';
import {User} from '../auth/entities/user.entity';
import {DealEntity} from '../deals/entities/deal.entity';
import {EscrowWalletEntity} from '../payments/entities/escrow-wallet.entity';
import {ChannelsModule} from '../channels/channels.module';
import {WalletsModule} from '../payments/wallets/wallets.module';
import {TelegramBotModule} from '../telegram-bot/telegram-bot.module';
import {PreDealsDeepLinkService} from './predeals-deep-link.service';
import {PreDealsTimeoutService} from './predeals-timeout.service';
import {PreDealsBotHandler} from './predeals-bot.handler';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            PreDealEntity,
            PreDealCreativeEntity,
            PreDealParticipantEntity,
            ListingEntity,
            ChannelEntity,
            ChannelMembershipEntity,
            User,
            DealEntity,
            EscrowWalletEntity,
        ]),
        ChannelsModule,
        WalletsModule,
        forwardRef(() => TelegramBotModule),
    ],
    controllers: [PreDealsController],
    providers: [
        PreDealsService,
        PreDealsDeepLinkService,
        PreDealsTimeoutService,
        PreDealsBotHandler,
    ],
    exports: [PreDealsService, PreDealsBotHandler],
})
export class PreDealsModule {}
