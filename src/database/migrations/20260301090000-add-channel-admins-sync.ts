import {MigrationInterface, QueryRunner} from 'typeorm';

export class AddChannelAdminsSync20260301090000 implements MigrationInterface {
    name = 'AddChannelAdminsSync20260301090000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            "CREATE TYPE \"channel_telegram_admins_telegram_role_enum\" AS ENUM('creator', 'administrator')",
        );

        await queryRunner.query(`
            CREATE TABLE "channel_telegram_admins" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "channelId" uuid NOT NULL,
                "telegramUserId" bigint NOT NULL,
                "username" text,
                "firstName" text,
                "lastName" text,
                "isBot" boolean NOT NULL DEFAULT false,
                "telegramRole" "channel_telegram_admins_telegram_role_enum" NOT NULL,
                "rights" jsonb,
                "isActive" boolean NOT NULL DEFAULT true,
                "lastSeenAt" TIMESTAMPTZ NOT NULL,
                "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT "PK_channel_telegram_admins_id" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(
            'CREATE INDEX "IDX_channel_telegram_admins_channel_id" ON "channel_telegram_admins" ("channelId")',
        );
        await queryRunner.query(
            'CREATE INDEX "IDX_channel_telegram_admins_telegram_user_id" ON "channel_telegram_admins" ("telegramUserId")',
        );
        await queryRunner.query(
            'CREATE UNIQUE INDEX "IDX_channel_telegram_admins_channel_user" ON "channel_telegram_admins" ("channelId", "telegramUserId")',
        );

        await queryRunner.query(
            'ALTER TABLE "channel_memberships" ADD COLUMN "isManuallyDisabled" boolean NOT NULL DEFAULT false',
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'ALTER TABLE "channel_memberships" DROP COLUMN "isManuallyDisabled"',
        );
        await queryRunner.query(
            'DROP INDEX "IDX_channel_telegram_admins_channel_user"',
        );
        await queryRunner.query(
            'DROP INDEX "IDX_channel_telegram_admins_telegram_user_id"',
        );
        await queryRunner.query(
            'DROP INDEX "IDX_channel_telegram_admins_channel_id"',
        );
        await queryRunner.query('DROP TABLE "channel_telegram_admins"');
        await queryRunner.query(
            'DROP TYPE "channel_telegram_admins_telegram_role_enum"',
        );
    }
}
