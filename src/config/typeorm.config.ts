import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { join } from 'path';
import * as fs from 'fs';
import * as path from 'path';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { ChannelEntity } from '../modules/channels/entities/channel.entity';
import { ChannelMembershipEntity } from '../modules/channels/entities/channel-membership.entity';
import { ChannelTelegramAdminEntity } from '../modules/channels/entities/channel-telegram-admin.entity';
import { DealEntity } from '../modules/deals/entities/deal.entity';
import { DealCreativeEntity } from '../modules/deals/entities/deal-creative.entity';
import { DealEscrowEntity } from '../modules/deals/entities/deal-escrow.entity';
import { DealPublicationEntity } from '../modules/deals/entities/deal-publication.entity';
import { ListingEntity } from '../modules/listings/entities/listing.entity';
import { EscrowWalletEntity } from '../modules/payments/entities/escrow-wallet.entity';
import { EscrowWalletKeyEntity } from '../modules/payments/entities/escrow-wallet-key.entity';
import { FeesConfigEntity } from '../modules/payments/entities/fees-config.entity';
import { LiquidityConfigEntity } from '../modules/payments/entities/liquidity-config.entity';
import { TonTransferEntity } from '../modules/payments/entities/ton-transfer.entity';
import { TransactionEntity } from '../modules/payments/entities/transaction.entity';
import { PayoutRequestEntity } from '../modules/payments/entities/payout-request.entity';
import { RefundRequestEntity } from '../modules/payments/entities/refund-request.entity';
import { UserWalletEntity } from '../modules/payments/entities/user-wallet.entity';
import { NotificationLogEntity } from '../modules/payments/entities/notification-log.entity';
import { User } from '../modules/auth/entities/user.entity';
import { DealPostAnalyticsEntity } from '../modules/post-analytics/entities/deal-post-analytics.entity';
import { DealPostAnalyticsLinkEntity } from '../modules/post-analytics/entities/deal-post-analytics-link.entity';
import { DealPostAnalyticsSnapshotEntity } from '../modules/post-analytics/entities/deal-post-analytics-snapshot.entity';
import {
  ENV,
  ENV_LITERAL_VALUES,
  NODE_ENV_VALUES,
} from '../common/constants/env.constants';

export const typeOrmEntities = [
  User,
  ChannelEntity,
  ChannelMembershipEntity,
  ChannelTelegramAdminEntity,
  TransactionEntity,
  TonTransferEntity,
  DealEntity,
  DealCreativeEntity,
  DealEscrowEntity,
  DealPublicationEntity,
  ListingEntity,
  EscrowWalletEntity,
  EscrowWalletKeyEntity,
  FeesConfigEntity,
  LiquidityConfigEntity,
  PayoutRequestEntity,
  RefundRequestEntity,
  UserWalletEntity,
  NotificationLogEntity,
  DealPostAnalyticsEntity,
  DealPostAnalyticsLinkEntity,
  DealPostAnalyticsSnapshotEntity,
];

const getSslConfig = (
  nodeEnv: string,
  logger: Logger,
): PostgresConnectionOptions['ssl'] => {
  const prodLikeEnvs: string[] = [
    NODE_ENV_VALUES.PRODUCTION,
    NODE_ENV_VALUES.STAGE,
  ];
  const isProdLike = prodLikeEnvs.includes(nodeEnv);

  if (!isProdLike) {
    return false;
  }

  const certificateFileName = 'postgramx-ca-certificate.crt';
  const certificateCandidates = [
    path.join(process.cwd(), 'certs', certificateFileName),
    path.join(__dirname, '..', 'certs', certificateFileName),
  ];
  const certificatePath = certificateCandidates.find((candidate) =>
    fs.existsSync(candidate),
  );

  if (!certificatePath) {
    logger.warn(
      [
        'SSL requested but certificate file was not found.',
        `Expected one of: ${certificateCandidates.join(', ')}`,
        'Disabling SSL configuration.',
      ].join(' '),
    );
    return false;
  }

  return {
    rejectUnauthorized: false,
    ca: fs.readFileSync(certificatePath).toString(),
  };
};

export const buildTypeOrmOptions = (
  config: ConfigService,
): TypeOrmModuleOptions => {
  const logger = new Logger('TypeOrmConfig');
  const nodeEnv = process.env[ENV.NODE_ENV] || '';
  const synchronizeEnv = config
    .get<string>('POSTGRES_SYNCHRONIZE')
    ?.toLowerCase();

  const synchronize =
    synchronizeEnv !== undefined
      ? synchronizeEnv === ENV_LITERAL_VALUES.TRUE
      : nodeEnv !== NODE_ENV_VALUES.PRODUCTION;
  const sslConfig = getSslConfig(nodeEnv, logger);

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
    synchronize: true,
    migrationsRun: false,
    migrations: [join(__dirname, '..', 'database', 'migrations', '*{.ts,.js}')],
    ssl: sslConfig,
    schema,
    extra: {
      connectionTimeoutMillis: connectionTimeout,
      ...(schema ? { searchPath: schema } : {}),
    },
  };
};
