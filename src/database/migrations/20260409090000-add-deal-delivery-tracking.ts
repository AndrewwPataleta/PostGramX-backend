import {MigrationInterface, QueryRunner} from 'typeorm';

export class AddDealDeliveryTracking20260409090000
    implements MigrationInterface
{
    name = 'AddDealDeliveryTracking20260409090000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deals_escrow_status_enum') THEN
                    ALTER TYPE "deals_escrow_status_enum" ADD VALUE IF NOT EXISTS 'POSTING';
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transactions_status_enum') THEN
                    ALTER TYPE "transactions_status_enum" ADD VALUE IF NOT EXISTS 'REFUNDED';
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            ALTER TABLE "deals"
            ADD COLUMN IF NOT EXISTS "publishedMessageId" bigint,
            ADD COLUMN IF NOT EXISTS "publishedAt" timestamptz,
            ADD COLUMN IF NOT EXISTS "deliveryVerifiedAt" timestamptz,
            ADD COLUMN IF NOT EXISTS "mustRemainUntil" timestamptz,
            ADD COLUMN IF NOT EXISTS "deliveryError" text
        `);

        await queryRunner.query(
            'CREATE INDEX IF NOT EXISTS "IDX_deals_scheduledAt_escrowStatus" ON "deals" ("scheduledAt", "escrowStatus")',
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'DROP INDEX IF EXISTS "IDX_deals_scheduledAt_escrowStatus"',
        );
        await queryRunner.query(`
            ALTER TABLE "deals"
            DROP COLUMN IF EXISTS "deliveryError",
            DROP COLUMN IF EXISTS "mustRemainUntil",
            DROP COLUMN IF EXISTS "deliveryVerifiedAt",
            DROP COLUMN IF EXISTS "publishedAt",
            DROP COLUMN IF EXISTS "publishedMessageId"
        `);
    }
}
