import {MigrationInterface, QueryRunner} from 'typeorm';

export class RemovePredealsAndUpdateDeals20260405090000
    implements MigrationInterface
{
    name = 'RemovePredealsAndUpdateDeals20260405090000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE IF EXISTS "pre_deal_participants"');
        await queryRunner.query('DROP TABLE IF EXISTS "pre_deal_creatives"');
        await queryRunner.query('DROP TABLE IF EXISTS "pre_deals"');
        await queryRunner.query('DROP TYPE IF EXISTS "pre_deal_participant_role_enum"');
        await queryRunner.query('DROP TYPE IF EXISTS "pre_deals_status_enum"');

        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'deals' AND column_name = 'predealexpiresat'
                ) THEN
                    ALTER TABLE "deals" RENAME COLUMN "predealExpiresAt" TO "idleExpiresAt";
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'deals' AND column_name = 'creativemustbesubmittedby'
                ) THEN
                    ALTER TABLE "deals" RENAME COLUMN "creativeMustBeSubmittedBy" TO "creativeDeadlineAt";
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'deals' AND column_name = 'adminmustrespondby'
                ) THEN
                    ALTER TABLE "deals" RENAME COLUMN "adminMustRespondBy" TO "adminReviewDeadlineAt";
                END IF;

                IF EXISTS (
                    SELECT 1
                    FROM information_schema.columns
                    WHERE table_name = 'deals' AND column_name = 'paymentmustbepaidby'
                ) THEN
                    ALTER TABLE "deals" RENAME COLUMN "paymentMustBePaidBy" TO "paymentDeadlineAt";
                END IF;
            END $$;
        `);

        await queryRunner.query(
            'ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "creativeMessageId" bigint',
        );
        await queryRunner.query(
            'ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "creativePayload" jsonb',
        );
        await queryRunner.query(
            'ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "creativeText" text',
        );
        await queryRunner.query(
            'ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "creativeSubmittedAt" timestamptz',
        );
        await queryRunner.query(
            'ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "adminReviewComment" text',
        );
        await queryRunner.query(
            'ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "approvedAt" timestamptz',
        );

        await queryRunner.query(
            'DROP INDEX IF EXISTS "IDX_deals_predeal_expires_at"',
        );
        await queryRunner.query(
            'CREATE INDEX IF NOT EXISTS "IDX_deals_idle_expires_at" ON "deals" ("idleExpiresAt")',
        );
        await queryRunner.query(
            'CREATE INDEX IF NOT EXISTS "IDX_deals_creative_deadline" ON "deals" ("creativeDeadlineAt")',
        );
        await queryRunner.query(
            'CREATE INDEX IF NOT EXISTS "IDX_deals_admin_deadline" ON "deals" ("adminReviewDeadlineAt")',
        );
        await queryRunner.query(
            'CREATE INDEX IF NOT EXISTS "IDX_deals_payment_deadline" ON "deals" ("paymentDeadlineAt")',
        );

        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deals_escrow_status_enum') THEN
                    CREATE TYPE "deals_escrow_status_enum_new" AS ENUM(
                        'DRAFT',
                        'WAITING_SCHEDULE',
                        'WAITING_CREATIVE',
                        'CREATIVE_SUBMITTED',
                        'ADMIN_REVIEW',
                        'CHANGES_REQUESTED',
                        'AWAITING_PAYMENT',
                        'PAYMENT_PENDING',
                        'FUNDS_CONFIRMED',
                        'SCHEDULED',
                        'POSTING',
                        'POSTED_VERIFYING',
                        'RELEASED',
                        'CANCELED',
                        'REFUNDED',
                        'DISPUTED'
                    );

                    ALTER TABLE "deals"
                        ALTER COLUMN "escrowStatus"
                        TYPE "deals_escrow_status_enum_new"
                        USING (
                            CASE "escrowStatus"::text
                                WHEN 'SCHEDULING_PENDING' THEN 'WAITING_SCHEDULE'
                                WHEN 'CREATIVE_AWAITING_SUBMIT' THEN 'WAITING_CREATIVE'
                                WHEN 'CREATIVE_AWAITING_CONFIRM' THEN 'CREATIVE_SUBMITTED'
                                WHEN 'PAYMENT_WINDOW_PENDING' THEN 'AWAITING_PAYMENT'
                                WHEN 'PAYMENT_AWAITING' THEN 'AWAITING_PAYMENT'
                                WHEN 'FUNDS_PENDING' THEN 'PAYMENT_PENDING'
                                WHEN 'CREATIVE_PENDING' THEN 'CHANGES_REQUESTED'
                                WHEN 'CREATIVE_REVIEW' THEN 'ADMIN_REVIEW'
                                WHEN 'APPROVED_SCHEDULED' THEN 'SCHEDULED'
                                WHEN 'COMPLETED' THEN 'RELEASED'
                                ELSE "escrowStatus"::text
                            END
                        )::"deals_escrow_status_enum_new";

                    DROP TYPE "deals_escrow_status_enum";
                    ALTER TYPE "deals_escrow_status_enum_new" RENAME TO "deals_escrow_status_enum";
                END IF;
            END $$;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP INDEX IF EXISTS "IDX_deals_idle_expires_at"');
        await queryRunner.query('DROP INDEX IF EXISTS "IDX_deals_creative_deadline"');
        await queryRunner.query('DROP INDEX IF EXISTS "IDX_deals_admin_deadline"');
        await queryRunner.query('DROP INDEX IF EXISTS "IDX_deals_payment_deadline"');

        await queryRunner.query(
            'ALTER TABLE "deals" DROP COLUMN IF EXISTS "approvedAt"',
        );
        await queryRunner.query(
            'ALTER TABLE "deals" DROP COLUMN IF EXISTS "adminReviewComment"',
        );
        await queryRunner.query(
            'ALTER TABLE "deals" DROP COLUMN IF EXISTS "creativeSubmittedAt"',
        );
        await queryRunner.query(
            'ALTER TABLE "deals" DROP COLUMN IF EXISTS "creativeText"',
        );
        await queryRunner.query(
            'ALTER TABLE "deals" DROP COLUMN IF EXISTS "creativePayload"',
        );
        await queryRunner.query(
            'ALTER TABLE "deals" DROP COLUMN IF EXISTS "creativeMessageId"',
        );

        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deals_escrow_status_enum') THEN
                    CREATE TYPE "deals_escrow_status_enum_old" AS ENUM(
                        'DRAFT',
                        'SCHEDULING_PENDING',
                        'CREATIVE_AWAITING_SUBMIT',
                        'CREATIVE_AWAITING_CONFIRM',
                        'ADMIN_REVIEW',
                        'PAYMENT_WINDOW_PENDING',
                        'PAYMENT_AWAITING',
                        'FUNDS_PENDING',
                        'FUNDS_CONFIRMED',
                        'CREATIVE_PENDING',
                        'CREATIVE_REVIEW',
                        'APPROVED_SCHEDULED',
                        'POSTED_VERIFYING',
                        'COMPLETED',
                        'CANCELED',
                        'REFUNDED',
                        'DISPUTED'
                    );

                    ALTER TABLE "deals"
                        ALTER COLUMN "escrowStatus"
                        TYPE "deals_escrow_status_enum_old"
                        USING (
                            CASE "escrowStatus"::text
                                WHEN 'WAITING_SCHEDULE' THEN 'SCHEDULING_PENDING'
                                WHEN 'WAITING_CREATIVE' THEN 'CREATIVE_AWAITING_SUBMIT'
                                WHEN 'CREATIVE_SUBMITTED' THEN 'CREATIVE_AWAITING_CONFIRM'
                                WHEN 'CHANGES_REQUESTED' THEN 'CREATIVE_PENDING'
                                WHEN 'AWAITING_PAYMENT' THEN 'PAYMENT_AWAITING'
                                WHEN 'PAYMENT_PENDING' THEN 'FUNDS_PENDING'
                                WHEN 'SCHEDULED' THEN 'APPROVED_SCHEDULED'
                                WHEN 'POSTING' THEN 'APPROVED_SCHEDULED'
                                WHEN 'RELEASED' THEN 'COMPLETED'
                                ELSE "escrowStatus"::text
                            END
                        )::"deals_escrow_status_enum_old";

                    DROP TYPE "deals_escrow_status_enum";
                    ALTER TYPE "deals_escrow_status_enum_old" RENAME TO "deals_escrow_status_enum";
                END IF;
            END $$;
        `);
    }
}
