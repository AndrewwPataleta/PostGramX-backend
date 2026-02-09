import {MigrationInterface, QueryRunner} from 'typeorm';

export class AddMtprotoAnalytics1760000000000 implements MigrationInterface {
    name = 'AddMtprotoAnalytics1760000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "telegram_mtproto_sessions" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "userId" uuid,
                "label" text NOT NULL,
                "encryptedSession" text NOT NULL,
                "isActive" boolean NOT NULL DEFAULT true,
                "lastCheckedAt" timestamptz,
                "lastErrorCode" text,
                "lastErrorMessage" text,
                "createdAt" timestamptz NOT NULL DEFAULT now(),
                "updatedAt" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "PK_telegram_mtproto_sessions" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_mtproto_sessions_user_label"
            ON "telegram_mtproto_sessions" ("userId", "label")
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "channel_analytics" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "channelId" uuid NOT NULL,
                "collectedAt" timestamptz NOT NULL,
                "subscribersCount" integer,
                "avgViews" integer,
                "avgForwards" integer,
                "avgReactions" integer,
                "postsSampleSize" integer NOT NULL,
                "lastPostId" bigint,
                "lastPostsPreview" jsonb,
                "rawMeta" jsonb,
                "createdAt" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "PK_channel_analytics" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_channel_analytics_channel_collected"
            ON "channel_analytics" ("channelId", "collectedAt" DESC)
        `);

        await queryRunner.query(`
            ALTER TABLE "channels"
            ADD COLUMN IF NOT EXISTS "lastPostsPreview" jsonb
        `);

        await queryRunner.query(`
            ALTER TABLE "channels"
            ADD COLUMN IF NOT EXISTS "analyticsUpdatedAt" timestamptz
        `);

        await queryRunner.query(`
            ALTER TABLE "channels"
            ADD COLUMN IF NOT EXISTS "mtprotoLastErrorCode" text
        `);

        await queryRunner.query(`
            ALTER TABLE "channels"
            ADD COLUMN IF NOT EXISTS "mtprotoLastErrorMessage" text
        `);

        await queryRunner.query(`
            ALTER TABLE "channels"
            ADD COLUMN IF NOT EXISTS "mtprotoLastErrorAt" timestamptz
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'ALTER TABLE "channels" DROP COLUMN IF EXISTS "mtprotoLastErrorAt"',
        );
        await queryRunner.query(
            'ALTER TABLE "channels" DROP COLUMN IF EXISTS "mtprotoLastErrorMessage"',
        );
        await queryRunner.query(
            'ALTER TABLE "channels" DROP COLUMN IF EXISTS "mtprotoLastErrorCode"',
        );
        await queryRunner.query(
            'ALTER TABLE "channels" DROP COLUMN IF EXISTS "analyticsUpdatedAt"',
        );
        await queryRunner.query(
            'ALTER TABLE "channels" DROP COLUMN IF EXISTS "lastPostsPreview"',
        );
        await queryRunner.query(
            'DROP INDEX IF EXISTS "IDX_channel_analytics_channel_collected"',
        );
        await queryRunner.query('DROP TABLE IF EXISTS "channel_analytics"');
        await queryRunner.query(
            'DROP INDEX IF EXISTS "IDX_mtproto_sessions_user_label"',
        );
        await queryRunner.query(
            'DROP TABLE IF EXISTS "telegram_mtproto_sessions"',
        );
    }
}
