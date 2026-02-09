import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
import {ChannelEntity} from '../channels/entities/channel.entity';
import {ChannelMembershipEntity} from '../channels/entities/channel-membership.entity';
import {TelegramBotModule} from '../telegram-bot/telegram-bot.module';
import {ChannelAnalyticsEntity} from './entities/channel-analytics.entity';
import {TelegramMtprotoSessionEntity} from './entities/telegram-mtproto-session.entity';
import {MtprotoSessionsController} from './controllers/mtproto-sessions.controller';
import {ChannelAnalyticsController} from './controllers/channel-analytics.controller';
import {MtprotoAnalyticsConfigService} from './services/mtproto-analytics-config.service';
import {MtprotoSessionCryptoService} from './services/mtproto-session-crypto.service';
import {MtprotoClientFactory} from './services/mtproto-client.factory';
import {ChannelAnalyticsCollectorService} from './services/channel-analytics-collector.service';
import {MtprotoAnalyticsCronService} from './services/mtproto-analytics-cron.service';
import {MtprotoAdminGuard} from './guards/mtproto-admin.guard';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            ChannelEntity,
            ChannelMembershipEntity,
            ChannelAnalyticsEntity,
            TelegramMtprotoSessionEntity,
        ]),
        TelegramBotModule,
    ],
    controllers: [MtprotoSessionsController, ChannelAnalyticsController],
    providers: [
        MtprotoAnalyticsConfigService,
        MtprotoSessionCryptoService,
        MtprotoClientFactory,
        ChannelAnalyticsCollectorService,
        MtprotoAnalyticsCronService,
        MtprotoAdminGuard,
    ],
})
export class TelegramMtprotoAnalyticsModule {}
