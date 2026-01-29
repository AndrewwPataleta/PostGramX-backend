import {Logger} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {TypeOrmModuleOptions} from '@nestjs/typeorm';
import {join} from 'path';
import * as fs from 'fs';
import * as path from 'path';
import {AdminPage} from '../modules/admin/entities/admin-page.entity';
import {AdminRule} from '../modules/admin/entities/admin-rule.entity';
import {AdminUser} from '../modules/admin/entities/admin-user.entity';
import {ChannelEntity} from '../modules/channels/entities/channel.entity';
import {ChannelMembershipEntity} from '../modules/channels/entities/channel-membership.entity';
import {ChannelTelegramAdminEntity} from '../modules/channels/entities/channel-telegram-admin.entity';
import {DealEntity} from '../modules/deals/entities/deal.entity';
import {ListingEntity} from '../modules/listings/entities/listing.entity';
import {EscrowWalletEntity} from '../modules/payments/entities/escrow-wallet.entity';
import {EscrowWalletKeyEntity} from '../modules/payments/entities/escrow-wallet-key.entity';
import {TransactionEntity} from '../modules/payments/entities/transaction.entity';
import {User} from '../modules/auth/entities/user.entity';

export const typeOrmEntities = [
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
];

const getSslConfig = (nodeEnv: string): TypeOrmModuleOptions['ssl'] => {
    const isProdLike = ['production', 'stage'].includes(nodeEnv);

    if (!isProdLike) {
        return false;
    }

    return {
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
    };
};

export const buildTypeOrmOptions = (
    config: ConfigService,
): TypeOrmModuleOptions => {
    const logger = new Logger('TypeOrmConfig');
    const nodeEnv = process.env.NODE_ENV || '';
    const synchronizeEnv = config
        .get<string>('POSTGRES_SYNCHRONIZE')
        ?.toLowerCase();
    const synchronize =
        synchronizeEnv !== undefined
            ? synchronizeEnv === 'true'
            : nodeEnv !== 'production';
    const sslConfig = getSslConfig(nodeEnv);

    const host = config.get('POSTGRES_HOST');
    const port = Number(config.get<number>('POSTGRES_PORT') ?? 5432);
    const database = config.get('POSTGRES_DB');
    const username = config.get('POSTGRES_USER');
    const connectionTimeout = Number(
        config.get<number>('POSTGRES_CONNECTION_TIMEOUT_MS') ?? 10000,
    );
    const schema = (config.get<string>('POSTGRES_SCHEMA') || 'public').trim();

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
        entities: typeOrmEntities,
        autoLoadEntities: true,
        synchronize: false,
        migrationsRun: true,
        migrations: [join(__dirname, '..', 'database', 'migrations', '*{.ts,.js}')],
        ssl: sslConfig,
        schema,
        extra: {
            connectionTimeoutMillis: connectionTimeout,
            ...(schema ? {searchPath: schema} : {}),
        },
    };
};
