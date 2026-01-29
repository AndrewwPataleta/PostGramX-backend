import {MigrationInterface, QueryRunner} from 'typeorm';

export class UpdateDealsEscrowStatuses20260328090000
    implements MigrationInterface
{
    name = 'UpdateDealsEscrowStatuses20260328090000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'ALTER TABLE "deals" ALTER COLUMN "escrowStatus" DROP DEFAULT',
        );
        await queryRunner.query(
            'ALTER TABLE "deals" ALTER COLUMN "escrowStatus" TYPE text USING "escrowStatus"::text',
        );

        await queryRunner.query(`
            UPDATE "deals"
            SET "escrowStatus" = CASE
                WHEN "escrowStatus" = 'NEGOTIATING' AND "scheduledAt" IS NULL THEN 'SCHEDULING_PENDING'
                WHEN "escrowStatus" = 'NEGOTIATING' AND ("brief" IS NULL OR btrim("brief") = '') THEN 'CREATIVE_AWAITING_SUBMIT'
                WHEN "escrowStatus" = 'NEGOTIATING' THEN 'ADMIN_REVIEW'
                WHEN "escrowStatus" = 'AWAITING_PAYMENT' THEN 'PAYMENT_AWAITING'
                ELSE "escrowStatus"
            END,
            "lastActivityAt" = now()
            WHERE "escrowStatus" IN ('NEGOTIATING', 'AWAITING_PAYMENT')
        `);

        await queryRunner.query(`
            UPDATE "deals"
            SET "status" = CASE
                WHEN "escrowStatus" IN (
                    'DRAFT',
                    'SCHEDULING_PENDING',
                    'CREATIVE_AWAITING_SUBMIT',
                    'CREATIVE_AWAITING_CONFIRM',
                    'ADMIN_REVIEW',
                    'PAYMENT_WINDOW_PENDING',
                    'PAYMENT_AWAITING',
                    'FUNDS_PENDING'
                ) THEN 'PENDING'
                WHEN "escrowStatus" IN (
                    'FUNDS_CONFIRMED',
                    'APPROVED_SCHEDULED',
                    'POSTED_VERIFYING',
                    'CREATIVE_PENDING',
                    'CREATIVE_REVIEW'
                ) THEN 'ACTIVE'
                WHEN "escrowStatus" = 'COMPLETED' THEN 'COMPLETED'
                WHEN "escrowStatus" IN ('CANCELED', 'REFUNDED', 'DISPUTED') THEN 'CANCELED'
                ELSE "status"
            END
        `);

        await queryRunner.query(
            "CREATE TYPE \"deals_escrow_status_enum_new\" AS ENUM('DRAFT', 'SCHEDULING_PENDING', 'CREATIVE_AWAITING_SUBMIT', 'CREATIVE_AWAITING_CONFIRM', 'ADMIN_REVIEW', 'PAYMENT_WINDOW_PENDING', 'PAYMENT_AWAITING', 'FUNDS_PENDING', 'FUNDS_CONFIRMED', 'CREATIVE_PENDING', 'CREATIVE_REVIEW', 'APPROVED_SCHEDULED', 'POSTED_VERIFYING', 'COMPLETED', 'CANCELED', 'REFUNDED', 'DISPUTED')",
        );
        await queryRunner.query(
            'ALTER TABLE "deals" ALTER COLUMN "escrowStatus" TYPE "deals_escrow_status_enum_new" USING "escrowStatus"::"deals_escrow_status_enum_new"',
        );
        await queryRunner.query('DROP TYPE "deals_escrow_status_enum"');
        await queryRunner.query(
            'ALTER TYPE "deals_escrow_status_enum_new" RENAME TO "deals_escrow_status_enum"',
        );
        await queryRunner.query(
            "ALTER TABLE \"deals\" ALTER COLUMN \"escrowStatus\" SET DEFAULT 'DRAFT'",
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'ALTER TABLE "deals" ALTER COLUMN "escrowStatus" DROP DEFAULT',
        );
        await queryRunner.query(
            'ALTER TABLE "deals" ALTER COLUMN "escrowStatus" TYPE text USING "escrowStatus"::text',
        );

        await queryRunner.query(`
            UPDATE "deals"
            SET "escrowStatus" = CASE
                WHEN "escrowStatus" IN (
                    'SCHEDULING_PENDING',
                    'CREATIVE_AWAITING_SUBMIT',
                    'CREATIVE_AWAITING_CONFIRM',
                    'ADMIN_REVIEW',
                    'PAYMENT_WINDOW_PENDING'
                ) THEN 'NEGOTIATING'
                WHEN "escrowStatus" = 'PAYMENT_AWAITING' THEN 'AWAITING_PAYMENT'
                ELSE "escrowStatus"
            END,
            "lastActivityAt" = now()
        `);

        await queryRunner.query(
            "CREATE TYPE \"deals_escrow_status_enum_old\" AS ENUM('DRAFT', 'NEGOTIATING', 'AWAITING_PAYMENT', 'FUNDS_PENDING', 'FUNDS_CONFIRMED', 'CREATIVE_PENDING', 'CREATIVE_REVIEW', 'APPROVED_SCHEDULED', 'POSTED_VERIFYING', 'COMPLETED', 'CANCELED', 'REFUNDED', 'DISPUTED')",
        );
        await queryRunner.query(
            'ALTER TABLE "deals" ALTER COLUMN "escrowStatus" TYPE "deals_escrow_status_enum_old" USING "escrowStatus"::"deals_escrow_status_enum_old"',
        );
        await queryRunner.query('DROP TYPE "deals_escrow_status_enum"');
        await queryRunner.query(
            'ALTER TYPE "deals_escrow_status_enum_old" RENAME TO "deals_escrow_status_enum"',
        );
        await queryRunner.query(
            "ALTER TABLE \"deals\" ALTER COLUMN \"escrowStatus\" SET DEFAULT 'DRAFT'",
        );
    }
}
