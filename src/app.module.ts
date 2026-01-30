import {MiddlewareConsumer, Module, NestModule} from '@nestjs/common';
import {AppController} from './app.controller';
import {AppService} from './app.service';
import {AuthModule} from './modules/auth/auth.module';
import {HealthModule} from './modules/health/health.module';
import {AuthMiddleware} from './modules/auth/middleware/auth.middleware';
import {RequestResponseLoggerMiddleware} from './common/middleware/request-response-logger.middleware';
import {ConfigModule, ConfigService} from '@nestjs/config';
import {ScheduleModule} from '@nestjs/schedule';
import {TypeOrmModule} from '@nestjs/typeorm';
import {I18nModule, AcceptLanguageResolver} from 'nestjs-i18n';
import {join} from 'path';
import {getEnvFilePath} from './config/env.helper';
import {AdminModule} from './modules/admin/admin.module';
import {CacheModule, CacheInterceptor} from '@nestjs/cache-manager';
import {APP_INTERCEPTOR} from '@nestjs/core';
import {CacheInvalidationSubscriber} from './database/cache-invalidation.subscriber';
import {AdminAccessMiddleware} from './modules/admin/middleware/admin-access.middleware';
import {ChannelsModule} from './modules/channels/channels.module';
import {PaymentsModule} from './modules/payments/payments.module';
import {DealsModule} from './modules/deals/deals.module';
import {ListingsModule} from './modules/listings/listings.module';
import {TelegramBotModule} from './modules/telegram-bot/telegram-bot.module';
import {MarketplaceModule} from './modules/marketplace/marketplace.module';
import {PreDealsModule} from './modules/predeals/predeals.module';
import {
    buildTypeOrmOptions,
    typeOrmEntities,
} from './config/typeorm.config';


@Module({
    imports: [
        CacheModule.register({ttl: 60, isGlobal: true}),
        I18nModule.forRoot({
            fallbackLanguage: 'en',
            loaderOptions: {
                path: join(process.cwd(), 'src/i18n'),
                watch: true,
            },
            resolvers: [
                {
                    use: AcceptLanguageResolver,
                    options: {matchType: 'strict-loose'},
                },
            ],
        }),
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: getEnvFilePath(),
        }),
        ScheduleModule.forRoot(),
        TypeOrmModule.forRootAsync({
            inject: [ConfigService],
            useFactory: buildTypeOrmOptions,
        }),
        TypeOrmModule.forFeature(typeOrmEntities),
        AuthModule,
        HealthModule,
        AdminModule,
        ChannelsModule,
        MarketplaceModule,
        DealsModule,
        ListingsModule,
        PaymentsModule,
        TelegramBotModule,
        PreDealsModule,
    ],
    controllers: [AppController],
    providers: [
        AppService,
        CacheInvalidationSubscriber,
        {provide: APP_INTERCEPTOR, useClass: CacheInterceptor},
    ],
})
export class AppModule implements NestModule {

    configure(consumer: MiddlewareConsumer) {
        consumer.apply(RequestResponseLoggerMiddleware).forRoutes('*');
        consumer.apply(AuthMiddleware).forRoutes('*');
        consumer.apply(AdminAccessMiddleware).forRoutes('admin/(.*)');
    }
}
