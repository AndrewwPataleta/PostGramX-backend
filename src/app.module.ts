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
import {UserProfileModule} from './modules/user-profile/user-profile.module';
import {ChannelsModule} from './modules/channels/channels.module';


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
                const isProdLike = ['production', 'stage'].includes(
                    process.env.NODE_ENV || '',
                );
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

                logger.log(
                    [
                        'Initializing database connection',
                        `host=${host}`,
                        `port=${port}`,
                        `database=${database}`,
                        `username=${username}`,
                        `ssl=${Boolean(sslConfig)}`,
                        `timeoutMs=${connectionTimeout}`,
                    ].join(' | '),
                );

                return {
                    type: 'postgres',
                    host,
                    port,
                    username,
                    password: config.get('POSTGRES_PASSWORD'),
                    database,
                    entities: [User],
                    autoLoadEntities: true,
                    synchronize: true,
                    ssl: sslConfig,
                    extra: {
                        connectionTimeoutMillis: connectionTimeout,
                    },
                } as TypeOrmModuleOptions;
            },
        }),
        TypeOrmModule.forFeature([User]),
        AuthModule,
        HealthModule,
        AdminModule,
        UserProfileModule,
        ChannelsModule,
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
