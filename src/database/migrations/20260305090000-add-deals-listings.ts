import {MigrationInterface, QueryRunner} from 'typeorm';

export class AddDealsListings20260305090000 implements MigrationInterface {
    name = 'AddDealsListings20260305090000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            "CREATE TYPE \"listings_status_enum\" AS ENUM('ACTIVE', 'DISABLED')",
        );
        await queryRunner.query(
            "CREATE TYPE \"deals_status_enum\" AS ENUM('PENDING', 'ACTIVE', 'COMPLETED', 'CANCELED')",
        );
        await queryRunner.query(
            "CREATE TYPE \"deals_side_initiator_enum\" AS ENUM('ADVERTISER', 'PUBLISHER')",
        );

        await queryRunner.query(`
            CREATE TABLE "listings" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "channelId" uuid NOT NULL,
                "createdByUserId" uuid NOT NULL,
                "title" text,
                "priceNano" bigint NOT NULL,
                "currency" character varying NOT NULL DEFAULT 'TON',
                "format" character varying NOT NULL DEFAULT 'post',
                "placementHours" integer,
                "lifetimeHours" integer,
                "allowPostEdit" boolean NOT NULL DEFAULT false,
                "tags" text[] NOT NULL DEFAULT '{}',
                "status" "listings_status_enum" NOT NULL DEFAULT 'ACTIVE',
                "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT "PK_listings_id" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(
            'CREATE INDEX "IDX_listings_channel_status" ON "listings" ("channelId", "status")',
        );

        await queryRunner.query(
            'ALTER TABLE "deals" RENAME COLUMN "channelOwnerUserId" TO "publisherOwnerUserId"',
        );

        await queryRunner.query(
            'ALTER TABLE "deals" ADD COLUMN "createdByUserId" uuid',
        );
        await queryRunner.query('ALTER TABLE "deals" ADD COLUMN "listingId" uuid');
        await queryRunner.query('ALTER TABLE "deals" ADD COLUMN "channelId" uuid');
        await queryRunner.query(
            'ALTER TABLE "deals" ADD COLUMN "sideInitiator" "deals_side_initiator_enum"',
        );
        await queryRunner.query(
            "ALTER TABLE \"deals\" ADD COLUMN \"status\" \"deals_status_enum\" NOT NULL DEFAULT 'PENDING'",
        );
        await queryRunner.query(
            'ALTER TABLE "deals" ADD COLUMN "offerSnapshot" jsonb',
        );
        await queryRunner.query('ALTER TABLE "deals" ADD COLUMN "brief" text');
        await queryRunner.query(
            'ALTER TABLE "deals" ADD COLUMN "scheduledAt" TIMESTAMPTZ',
        );

        await queryRunner.query(
            'CREATE INDEX "IDX_deals_advertiser_status" ON "deals" ("advertiserUserId", "status")',
        );
        await queryRunner.query(
            'CREATE INDEX "IDX_deals_publisher_status" ON "deals" ("publisherOwnerUserId", "status")',
        );
        await queryRunner.query(
            'CREATE INDEX "IDX_deals_listing_id" ON "deals" ("listingId")',
        );
        await queryRunner.query(
            'CREATE INDEX "IDX_deals_channel_id" ON "deals" ("channelId")',
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP INDEX "IDX_deals_channel_id"');
        await queryRunner.query('DROP INDEX "IDX_deals_listing_id"');
        await queryRunner.query('DROP INDEX "IDX_deals_publisher_status"');
        await queryRunner.query('DROP INDEX "IDX_deals_advertiser_status"');

        await queryRunner.query(
            'ALTER TABLE "deals" DROP COLUMN "scheduledAt"',
        );
        await queryRunner.query('ALTER TABLE "deals" DROP COLUMN "brief"');
        await queryRunner.query(
            'ALTER TABLE "deals" DROP COLUMN "offerSnapshot"',
        );
        await queryRunner.query('ALTER TABLE "deals" DROP COLUMN "status"');
        await queryRunner.query('ALTER TABLE "deals" DROP COLUMN "sideInitiator"');
        await queryRunner.query('ALTER TABLE "deals" DROP COLUMN "channelId"');
        await queryRunner.query('ALTER TABLE "deals" DROP COLUMN "listingId"');
        await queryRunner.query('ALTER TABLE "deals" DROP COLUMN "createdByUserId"');

        await queryRunner.query(
            'ALTER TABLE "deals" RENAME COLUMN "publisherOwnerUserId" TO "channelOwnerUserId"',
        );

        await queryRunner.query('DROP INDEX "IDX_listings_channel_status"');
        await queryRunner.query('DROP TABLE "listings"');

        await queryRunner.query('DROP TYPE "deals_side_initiator_enum"');
        await queryRunner.query('DROP TYPE "deals_status_enum"');
        await queryRunner.query('DROP TYPE "listings_status_enum"');
    }
}
