import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {DealEntity} from '../modules/deals/entities/deal.entity';
import {DealCreativeEntity} from '../modules/deals/entities/deal-creative.entity';
import {DealEscrowEntity} from '../modules/deals/entities/deal-escrow.entity';
import {DealPublicationEntity} from '../modules/deals/entities/deal-publication.entity';
import {ChannelEntity} from '../modules/channels/entities/channel.entity';
import {User} from '../modules/auth/entities/user.entity';
import {TelegramPosterService} from './services/telegram-poster.service';
import {DealPostingWorker} from './services/deal-posting.worker';
import {TelegramModule} from '../modules/telegram/telegram.module';
import {TelegramBotModule} from '../modules/telegram-bot/telegram-bot.module';
import {ChannelsModule} from '../modules/channels/channels.module';
import {PaymentsModule} from '../modules/payments/payments.module';
import {DealsModule} from '../modules/deals/deals.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            DealEntity,
            DealCreativeEntity,
            DealEscrowEntity,
            DealPublicationEntity,
            ChannelEntity,
            User,
        ]),
        TelegramModule,
        TelegramBotModule,
        ChannelsModule,
        PaymentsModule,
        DealsModule,
    ],
    providers: [
        TelegramPosterService,
        DealPostingWorker,
    ],
})
export class DealDeliveryMonitorModule {}
