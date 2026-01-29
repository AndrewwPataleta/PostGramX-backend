import {MigrationInterface, QueryRunner} from 'typeorm';

export class AddPreDeals20260325090000 implements MigrationInterface {
    name = 'AddPreDeals20260325090000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            "CREATE TYPE \"pre_deals_status_enum\" AS ENUM('DRAFT', 'AWAITING_CREATIVE', 'CREATIVE_SUBMITTED', 'AWAITING_ADVERTISER_CONFIRMATION', 'AWAITING_PUBLISHER_APPROVAL', 'AWAITING_PAYMENT_WINDOW', 'READY_FOR_PAYMENT', 'REJECTED', 'CANCELED', 'EXPIRED')",
        );
        await queryRunner.query(
            "CREATE TYPE \"pre_deal_participant_role_enum\" AS ENUM('ADVERTISER', 'PUBLISHER_ADMIN')",
        );
        await queryRunner.query(
            `CREATE TABLE "pre_deals" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "listingId" uuid NOT NULL,
                "channelId" uuid NOT NULL,
                "advertiserUserId" uuid NOT NULL,
                "dealId" uuid,
                "status" "pre_deals_status_enum" NOT NULL DEFAULT 'DRAFT',
                "scheduledAt" timestamptz NOT NULL,
                "paymentWindowSeconds" integer,
                "paymentExpiresAt" timestamptz,
                "advertiserConfirmedAt" timestamptz,
                "publisherApprovedAt" timestamptz,
                "publisherRejectedAt" timestamptz,
                "publisherDecisionByTelegramId" text,
                "rejectReason" text,
                "expectedAmountNano" bigint,
                "listingSnapshot" jsonb NOT NULL DEFAULT '{}'::jsonb,
                "lastActivityAt" timestamptz NOT NULL DEFAULT now(),
                "expiresAt" timestamptz,
                "createdAt" timestamptz NOT NULL DEFAULT now(),
                "updatedAt" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "PK_pre_deals_id" PRIMARY KEY ("id")
            )`,
        );
        await queryRunner.query(
            `CREATE TABLE "pre_deal_creatives" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "preDealId" uuid NOT NULL,
                "fromUserId" uuid NOT NULL,
                "telegramChatId" text NOT NULL,
                "telegramMessageId" bigint NOT NULL,
                "text" text,
                "attachments" jsonb,
                "createdAt" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "PK_pre_deal_creatives_id" PRIMARY KEY ("id")
            )`,
        );
        await queryRunner.query(
            `CREATE TABLE "pre_deal_participants" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "preDealId" uuid NOT NULL,
                "userId" uuid NOT NULL,
                "role" "pre_deal_participant_role_enum" NOT NULL,
                "telegramUserId" text,
                "telegramChatId" text,
                "isActive" boolean NOT NULL DEFAULT false,
                "createdAt" timestamptz NOT NULL DEFAULT now(),
                "updatedAt" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "PK_pre_deal_participants_id" PRIMARY KEY ("id")
            )`,
        );

        await queryRunner.query(
            'CREATE INDEX "IDX_pre_deals_advertiser_status" ON "pre_deals" ("advertiserUserId", "status")',
        );
        await queryRunner.query(
            'CREATE INDEX "IDX_pre_deals_listing_id" ON "pre_deals" ("listingId")',
        );
        await queryRunner.query(
            'CREATE INDEX "IDX_pre_deals_channel_id" ON "pre_deals" ("channelId")',
        );
        await queryRunner.query(
            'CREATE INDEX "IDX_pre_deals_last_activity_at" ON "pre_deals" ("lastActivityAt")',
        );
        await queryRunner.query(
            'CREATE INDEX "IDX_pre_deal_creatives_pre_deal_id" ON "pre_deal_creatives" ("preDealId")',
        );
        await queryRunner.query(
            'CREATE INDEX "IDX_pre_deal_participants_pre_deal_id" ON "pre_deal_participants" ("preDealId")',
        );
        await queryRunner.query(
            'CREATE INDEX "IDX_pre_deal_participants_user_id" ON "pre_deal_participants" ("userId")',
        );
        await queryRunner.query(
            'CREATE INDEX "IDX_pre_deal_participants_user_active" ON "pre_deal_participants" ("userId", "isActive")',
        );
        await queryRunner.query(
            'CREATE UNIQUE INDEX "IDX_pre_deal_participants_pre_deal_user_role" ON "pre_deal_participants" ("preDealId", "userId", "role")',
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'DROP INDEX "IDX_pre_deal_participants_pre_deal_user_role"',
        );
        await queryRunner.query(
            'DROP INDEX "IDX_pre_deal_participants_user_active"',
        );
        await queryRunner.query(
            'DROP INDEX "IDX_pre_deal_participants_user_id"',
        );
        await queryRunner.query(
            'DROP INDEX "IDX_pre_deal_participants_pre_deal_id"',
        );
        await queryRunner.query(
            'DROP INDEX "IDX_pre_deal_creatives_pre_deal_id"',
        );
        await queryRunner.query('DROP INDEX "IDX_pre_deals_last_activity_at"');
        await queryRunner.query('DROP INDEX "IDX_pre_deals_channel_id"');
        await queryRunner.query('DROP INDEX "IDX_pre_deals_listing_id"');
        await queryRunner.query('DROP INDEX "IDX_pre_deals_advertiser_status"');
        await queryRunner.query('DROP TABLE "pre_deal_participants"');
        await queryRunner.query('DROP TABLE "pre_deal_creatives"');
        await queryRunner.query('DROP TABLE "pre_deals"');
        await queryRunner.query('DROP TYPE "pre_deal_participant_role_enum"');
        await queryRunner.query('DROP TYPE "pre_deals_status_enum"');
    }
}
