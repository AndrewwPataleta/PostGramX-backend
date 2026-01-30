import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {DealEntity} from '../modules/deals/entities/deal.entity';
import {DealCreativeEntity} from '../modules/deals/entities/deal-creative.entity';
import {ChannelEntity} from '../modules/channels/entities/channel.entity';
import {TransactionEntity} from '../modules/payments/entities/transaction.entity';
import {User} from '../modules/auth/entities/user.entity';
import {DealsDeliveryService} from './services/deals-delivery.service';
import {DealsDeliveryCronService} from './services/deals-delivery-cron.service';
import {TelegramPosterService} from './services/telegram-poster.service';
import {DealDeliveryReconcilerService} from './services/deal-delivery-reconciler.service';
import {TelegramModule} from '../modules/telegram/telegram.module';
import {TelegramBotModule} from '../modules/telegram-bot/telegram-bot.module';
import {ChannelsModule} from '../modules/channels/channels.module';
import {PaymentsModule} from '../modules/payments/payments.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            DealEntity,
            DealCreativeEntity,
            ChannelEntity,
            TransactionEntity,
            User,
        ]),
        TelegramModule,
        TelegramBotModule,
        ChannelsModule,
        PaymentsModule,
    ],
    providers: [
        DealsDeliveryService,
        DealsDeliveryCronService,
        TelegramPosterService,
        DealDeliveryReconcilerService,
    ],
})
export class DealDeliveryMonitorModule {}
