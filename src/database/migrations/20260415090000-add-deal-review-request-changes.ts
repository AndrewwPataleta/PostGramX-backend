import {MigrationInterface, QueryRunner} from 'typeorm';

export class AddDealReviewRequestChanges20260415090000
    implements MigrationInterface
{
    name = 'AddDealReviewRequestChanges20260415090000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deals_escrow_status_enum') THEN
                    ALTER TYPE "deals_escrow_status_enum" ADD VALUE IF NOT EXISTS 'CREATIVE_CHANGES_NOTES_PENDING';
                    ALTER TYPE "deals_escrow_status_enum" ADD VALUE IF NOT EXISTS 'CREATIVE_CHANGES_REQUESTED';
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            ALTER TABLE "deals"
            ADD COLUMN IF NOT EXISTS "adminReviewRequestedAt" timestamptz,
            ADD COLUMN IF NOT EXISTS "adminReviewRequestedByUserId" uuid,
            ADD COLUMN IF NOT EXISTS "adminReviewActionMessageId" bigint,
            ADD COLUMN IF NOT EXISTS "adminReviewChatId" bigint,
            ADD COLUMN IF NOT EXISTS "adminReviewReplyMessageId" bigint
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "deals"
            DROP COLUMN IF EXISTS "adminReviewReplyMessageId",
            DROP COLUMN IF EXISTS "adminReviewChatId",
            DROP COLUMN IF EXISTS "adminReviewActionMessageId",
            DROP COLUMN IF EXISTS "adminReviewRequestedByUserId",
            DROP COLUMN IF EXISTS "adminReviewRequestedAt"
        `);
    }
}
