import {Logger, MiddlewareConsumer, Module, NestModule} from '@nestjs/common';
import {AppController} from './app.controller';
import {AppService} from './app.service';
import {AuthModule} from './modules/auth/auth.module';
import {HealthModule} from './modules/health/health.module';
import {AuthMiddleware} from './modules/auth/middleware/auth.middleware';
import {RequestResponseLoggerMiddleware} from './common/middleware/request-response-logger.middleware';
import {ConfigModule, ConfigService} from '@nestjs/config';
import {ScheduleModule} from '@nestjs/schedule';
import {TypeOrmModule, TypeOrmModuleOptions} from '@nestjs/typeorm';
import {I18nModule, AcceptLanguageResolver} from 'nestjs-i18n';
import {join} from 'path';
import * as fs from 'fs';
import * as path from 'path';
import {getEnvFilePath} from './config/env.helper';
import {AdminModule} from './modules/admin/admin.module';
import {User} from './modules/auth/entities/user.entity';
import {CacheModule, CacheInterceptor} from '@nestjs/cache-manager';
import {APP_INTERCEPTOR} from '@nestjs/core';
import {CacheInvalidationSubscriber} from './database/cache-invalidation.subscriber';
import {ChannelsModule} from './modules/channels/channels.module';
import {AdminPage} from './modules/admin/entities/admin-page.entity';
import {AdminRule} from './modules/admin/entities/admin-rule.entity';
import {AdminUser} from './modules/admin/entities/admin-user.entity';
import {ChannelEntity} from './modules/channels/entities/channel.entity';
import {ChannelMembershipEntity} from './modules/channels/entities/channel-membership.entity';
import {ChannelTelegramAdminEntity} from './modules/channels/entities/channel-telegram-admin.entity';
import {PaymentsModule} from './modules/payments/payments.module';
import {TransactionEntity} from './modules/payments/entities/transaction.entity';
import {DealEntity} from './modules/deals/entities/deal.entity';
import {EscrowWalletEntity} from './modules/payments/entities/escrow-wallet.entity';
import {EscrowWalletKeyEntity} from './modules/payments/entities/escrow-wallet-key.entity';
import {DealsModule} from './modules/deals/deals.module';
import {ListingEntity} from './modules/listings/entities/listing.entity';
import {ListingsModule} from './modules/listings/listings.module';


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
            useFactory: (config: ConfigService): TypeOrmModuleOptions => {
                const logger = new Logger('TypeOrmConfig');
                const nodeEnv = process.env.NODE_ENV || '';
                const isProdLike = ['production', 'stage'].includes(nodeEnv);
                const synchronizeEnv = config
                    .get<string>('POSTGRES_SYNCHRONIZE')
                    ?.toLowerCase();
                const synchronize =
                    synchronizeEnv !== undefined
                        ? synchronizeEnv === 'true'
                        : nodeEnv !== 'production';
                const sslConfig = isProdLike ? {
                    rejectUnauthorized: false,
                    ca: fs
                        .readFileSync(
                            path.join(
                                __dirname,
                                '..',
                                'certs',
                                'postgramx-ca-certificate.crt',
                            ),
                        )
                        .toString(),
                } : false;

                const host = config.get('POSTGRES_HOST');
                const port = Number(config.get<number>('POSTGRES_PORT') ?? 5432);
                const database = config.get('POSTGRES_DB');
                const username = config.get('POSTGRES_USER');
                const connectionTimeout = Number(
                    config.get<number>('POSTGRES_CONNECTION_TIMEOUT_MS') ?? 10000,
                );
                const rawSchema = config.get<string>('POSTGRES_SCHEMA');
                const schema = rawSchema?.trim() || username || undefined;

                logger.log(
                    [
                        'Initializing database connection',
                        `host=${host}`,
                        `port=${port}`,
                        `database=${database}`,
                        `username=${username}`,
                        `schema=${schema ?? 'default'}`,
                        `ssl=${Boolean(sslConfig)}`,
                        `timeoutMs=${connectionTimeout}`,
                        `synchronize=${synchronize}`,
                    ].join(' | '),
                );

                return {
                    type: 'postgres',
                    host,
                    port,
                    username,
                    password: config.get('POSTGRES_PASSWORD'),
                    database,
                    entities: [
                        User,
                        AdminPage,
                        AdminRule,
                        AdminUser,
                        ChannelEntity,
                        ChannelMembershipEntity,
                        ChannelTelegramAdminEntity,
                        TransactionEntity,
                        DealEntity,
                        ListingEntity,
                        EscrowWalletEntity,
                        EscrowWalletKeyEntity,
                    ],
                    autoLoadEntities: true,
                    synchronize: false,
                    migrationsRun: true,
                    migrations: [
                        join(__dirname, 'database', 'migrations', '*{.ts,.js}'),
                    ],
                    ssl: sslConfig,
                    schema,
                    extra: {
                        connectionTimeoutMillis: connectionTimeout,
                        ...(schema ? {searchPath: schema} : {}),
                    },
                } as TypeOrmModuleOptions;
            },
        }),
        TypeOrmModule.forFeature([
            User,
            AdminPage,
            AdminRule,
            AdminUser,
            ChannelEntity,
            ChannelMembershipEntity,
            ChannelTelegramAdminEntity,
            TransactionEntity,
            DealEntity,
            ListingEntity,
            EscrowWalletEntity,
            EscrowWalletKeyEntity,
        ]),
        AuthModule,
        HealthModule,
        AdminModule,
        ChannelsModule,
        DealsModule,
        ListingsModule,
        PaymentsModule,
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
        consumer.apply(AuthMiddleware).exclude('admin/(.*)').forRoutes('*');
    }
}
