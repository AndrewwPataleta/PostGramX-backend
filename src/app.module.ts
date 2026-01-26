import {Module, Logger} from '@nestjs/common';
import {ConfigModule, ConfigService} from '@nestjs/config';
import {TypeOrmModule, TypeOrmModuleOptions} from '@nestjs/typeorm';
import * as fs from 'fs';
import * as path from 'path';
import {getEnvFilePath} from './config/env.helper';

import {AuthModule} from './modules/auth/auth.module';
import {TelegramModule} from './modules/telegram/telegram.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: getEnvFilePath(),
        }),
        TypeOrmModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService): TypeOrmModuleOptions => {
                const isProdLike = ['production', 'stage'].includes(
                    process.env.NODE_ENV || '',
                );
                const logger = new Logger('TypeORM');

                const sslConfig = isProdLike
                    ? {
                        rejectUnauthorized: false,
                        ca: fs
                            .readFileSync(
                                path.join(
                                    __dirname,
                                    '..',
                                    'certs',
                                    'postgramx-database-cert.crt',
                                ),
                            )
                            .toString(),
                    }
                    : false;

                logger.log(
                    `📡 Connecting to DB at env ${config.get('NODE_ENV')} ${config.get('POSTGRES_HOST')}:${config.get(
                        'POSTGRES_PORT',
                    )} (${isProdLike ? 'SSL' : 'No SSL'})`,
                );

                return {
                    type: 'postgres',
                    host: config.get('POSTGRES_HOST'),
                    port: +config.get<number>('POSTGRES_PORT'),
                    username: config.get('POSTGRES_USER'),
                    password: config.get('POSTGRES_PASSWORD'),
                    database: config.get('POSTGRES_DB'),
                    autoLoadEntities: true,
                    synchronize: false,
                    migrationsRun: false,
                    migrations: [],
                    ssl: sslConfig,
                } as TypeOrmModuleOptions;
            },
        }),
        AuthModule,
     //   TelegramModule,
    ],
    providers: [],
})
export class AppModule {}
