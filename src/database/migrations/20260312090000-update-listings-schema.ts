import {MigrationInterface, QueryRunner} from 'typeorm';

export class UpdateListingsSchema20260312090000 implements MigrationInterface {
    name = 'UpdateListingsSchema20260312090000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP INDEX "IDX_listings_channel_status"');

        await queryRunner.query(
            'ALTER TABLE "listings" DROP COLUMN "status"',
        );
        await queryRunner.query('ALTER TABLE "listings" DROP COLUMN "title"');
        await queryRunner.query(
            'ALTER TABLE "listings" DROP COLUMN "placementHours"',
        );
        await queryRunner.query(
            'ALTER TABLE "listings" DROP COLUMN "lifetimeHours"',
        );
        await queryRunner.query(
            'ALTER TABLE "listings" DROP COLUMN "allowPostEdit"',
        );

        await queryRunner.query(
            'ALTER TABLE "listings" ADD "availabilityFrom" TIMESTAMPTZ NOT NULL DEFAULT now()',
        );
        await queryRunner.query(
            'ALTER TABLE "listings" ADD "availabilityTo" TIMESTAMPTZ NOT NULL DEFAULT now()',
        );
        await queryRunner.query(
            'ALTER TABLE "listings" ADD "pinDurationHours" integer',
        );
        await queryRunner.query(
            'ALTER TABLE "listings" ADD "visibilityDurationHours" integer NOT NULL DEFAULT 24',
        );
        await queryRunner.query(
            'ALTER TABLE "listings" ADD "allowEdits" boolean NOT NULL DEFAULT false',
        );
        await queryRunner.query(
            'ALTER TABLE "listings" ADD "allowLinkTracking" boolean NOT NULL DEFAULT false',
        );
        await queryRunner.query(
            'ALTER TABLE "listings" ADD "allowPinnedPlacement" boolean NOT NULL DEFAULT false',
        );
        await queryRunner.query(
            'ALTER TABLE "listings" ADD "requiresApproval" boolean NOT NULL DEFAULT true',
        );
        await queryRunner.query(
            'ALTER TABLE "listings" ADD "isActive" boolean NOT NULL DEFAULT true',
        );
        await queryRunner.query(
            "ALTER TABLE \"listings\" ADD \"contentRulesText\" text NOT NULL DEFAULT ''",
        );

        await queryRunner.query(
            'UPDATE "listings" SET "format" = UPPER("format")',
        );
        await queryRunner.query(
            'ALTER TABLE "listings" ALTER COLUMN "format" TYPE text',
        );
        await queryRunner.query(
            'ALTER TABLE "listings" ALTER COLUMN "format" SET NOT NULL',
        );
        await queryRunner.query(
            "ALTER TABLE \"listings\" ALTER COLUMN \"format\" SET DEFAULT 'POST'",
        );
        await queryRunner.query(
            'ALTER TABLE "listings" ALTER COLUMN "availabilityFrom" DROP DEFAULT',
        );
        await queryRunner.query(
            'ALTER TABLE "listings" ALTER COLUMN "availabilityTo" DROP DEFAULT',
        );
        await queryRunner.query(
            'ALTER TABLE "listings" ALTER COLUMN "visibilityDurationHours" DROP DEFAULT',
        );

        await queryRunner.query(
            'CREATE INDEX "IDX_listings_channel_active" ON "listings" ("channelId", "isActive")',
        );
        await queryRunner.query(
            'CREATE INDEX "IDX_listings_created_by_created_at" ON "listings" ("createdByUserId", "createdAt")',
        );
        await queryRunner.query(
            'ALTER TABLE "listings" ADD CONSTRAINT "FK_listings_channel" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE',
        );
        await queryRunner.query(
            'ALTER TABLE "listings" ADD CONSTRAINT "FK_listings_user" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE CASCADE',
        );

        await queryRunner.query('DROP TYPE "listings_status_enum"');
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'ALTER TABLE "listings" DROP CONSTRAINT "FK_listings_user"',
        );
        await queryRunner.query(
            'ALTER TABLE "listings" DROP CONSTRAINT "FK_listings_channel"',
        );
        await queryRunner.query('DROP INDEX "IDX_listings_created_by_created_at"');
        await queryRunner.query('DROP INDEX "IDX_listings_channel_active"');

        await queryRunner.query(
            'ALTER TABLE "listings" DROP COLUMN "contentRulesText"',
        );
        await queryRunner.query('ALTER TABLE "listings" DROP COLUMN "isActive"');
        await queryRunner.query(
            'ALTER TABLE "listings" DROP COLUMN "requiresApproval"',
        );
        await queryRunner.query(
            'ALTER TABLE "listings" DROP COLUMN "allowPinnedPlacement"',
        );
        await queryRunner.query(
            'ALTER TABLE "listings" DROP COLUMN "allowLinkTracking"',
        );
        await queryRunner.query('ALTER TABLE "listings" DROP COLUMN "allowEdits"');
        await queryRunner.query(
            'ALTER TABLE "listings" DROP COLUMN "visibilityDurationHours"',
        );
        await queryRunner.query(
            'ALTER TABLE "listings" DROP COLUMN "pinDurationHours"',
        );
        await queryRunner.query(
            'ALTER TABLE "listings" DROP COLUMN "availabilityTo"',
        );
        await queryRunner.query(
            'ALTER TABLE "listings" DROP COLUMN "availabilityFrom"',
        );

        await queryRunner.query(
            'CREATE TYPE "listings_status_enum" AS ENUM(\'ACTIVE\', \'DISABLED\')',
        );

        await queryRunner.query(
            'ALTER TABLE "listings" ADD "title" text',
        );
        await queryRunner.query(
            'ALTER TABLE "listings" ADD "placementHours" integer',
        );
        await queryRunner.query(
            'ALTER TABLE "listings" ADD "lifetimeHours" integer',
        );
        await queryRunner.query(
            'ALTER TABLE "listings" ADD "allowPostEdit" boolean NOT NULL DEFAULT false',
        );
        await queryRunner.query(
            'ALTER TABLE "listings" ADD "status" "listings_status_enum" NOT NULL DEFAULT \'ACTIVE\'',
        );

        await queryRunner.query(
            'UPDATE "listings" SET "format" = LOWER("format")',
        );
        await queryRunner.query(
            "ALTER TABLE \"listings\" ALTER COLUMN \"format\" SET DEFAULT 'post'",
        );

        await queryRunner.query(
            'CREATE INDEX "IDX_listings_channel_status" ON "listings" ("channelId", "status")',
        );
    }
}
