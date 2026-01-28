import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {DealEntity} from './entities/deal.entity';
import {ListingEntity} from '../listings/entities/listing.entity';
import {DealsService} from './deals.service';
import {DealsController} from './deals.controller';
import {ChannelEntity} from '../channels/entities/channel.entity';
import {DealsNotificationsService} from './deals-notifications.service';
import {DealsDeepLinkService} from './deals-deep-link.service';
import {ChannelsModule} from '../channels/channels.module';
import {TelegramBotModule} from '../telegram-bot/telegram-bot.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([DealEntity, ListingEntity, ChannelEntity]),
        ChannelsModule,
        TelegramBotModule,
    ],
    controllers: [DealsController],
    providers: [DealsService, DealsNotificationsService, DealsDeepLinkService],
    exports: [DealsService],
})
export class DealsModule {}
