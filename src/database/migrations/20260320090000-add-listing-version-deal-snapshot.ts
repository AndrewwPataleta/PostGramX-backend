import {MigrationInterface, QueryRunner} from 'typeorm';

export class AddListingVersionDealSnapshot20260320090000
    implements MigrationInterface
{
    name = 'AddListingVersionDealSnapshot20260320090000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'ALTER TABLE "listings" ADD "version" integer NOT NULL DEFAULT 1',
        );
        await queryRunner.query(
            'ALTER TABLE "deals" ADD "listingSnapshot" jsonb NOT NULL DEFAULT \'{}\'::jsonb',
        );

        await queryRunner.query(
            `UPDATE "deals" SET "listingSnapshot" = jsonb_build_object(
                'listingId', "listings"."id",
                'channelId', "listings"."channelId",
                'format', "listings"."format",
                'priceNano', "listings"."priceNano",
                'currency', "listings"."currency",
                'tags', "listings"."tags",
                'pinDurationHours', "listings"."pinDurationHours",
                'visibilityDurationHours', "listings"."visibilityDurationHours",
                'allowEdits', "listings"."allowEdits",
                'allowLinkTracking', "listings"."allowLinkTracking",
                'allowPinnedPlacement', "listings"."allowPinnedPlacement",
                'requiresApproval', "listings"."requiresApproval",
                'contentRulesText', "listings"."contentRulesText",
                'version', "listings"."version",
                'snapshotAt', now()::text
            )
            FROM "listings"
            WHERE "deals"."listingId" = "listings"."id"`,
        );

        await queryRunner.query(
            `UPDATE "deals" SET "listingSnapshot" = jsonb_build_object(
                'listingId', "listingId",
                'channelId', "channelId",
                'snapshotAt', now()::text
            )
            WHERE "listingSnapshot" = '{}'::jsonb`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('ALTER TABLE "deals" DROP COLUMN "listingSnapshot"');
        await queryRunner.query('ALTER TABLE "listings" DROP COLUMN "version"');
    }
}
