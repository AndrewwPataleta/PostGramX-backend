import {MigrationInterface, QueryRunner} from 'typeorm';

export class AddDealCreatives20260406090000 implements MigrationInterface {
    name = 'AddDealCreatives20260406090000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'deals_escrow_status_enum') THEN
                    ALTER TYPE "deals_escrow_status_enum" ADD VALUE IF NOT EXISTS 'CREATIVE_RECEIVED';
                    ALTER TYPE "deals_escrow_status_enum" ADD VALUE IF NOT EXISTS 'CREATIVE_AWAITING_ADMIN_REVIEW';
                END IF;
            END $$;
        `);

        await queryRunner.query(
            "CREATE TYPE \"deal_creative_type_enum\" AS ENUM('TEXT', 'IMAGE', 'VIDEO')",
        );

        await queryRunner.query(`
            CREATE TABLE "deal_creatives" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "dealId" uuid NOT NULL,
                "type" "deal_creative_type_enum" NOT NULL,
                "text" text,
                "mediaFileId" text,
                "caption" text,
                "rawPayload" jsonb,
                "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT "PK_deal_creatives_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_deal_creatives_deal_id" UNIQUE ("dealId")
            )
        `);

        await queryRunner.query(
            'CREATE INDEX "IDX_deal_creatives_created_at" ON "deal_creatives" ("createdAt")',
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'DROP INDEX IF EXISTS "IDX_deal_creatives_created_at"',
        );
        await queryRunner.query('DROP TABLE IF EXISTS "deal_creatives"');
        await queryRunner.query('DROP TYPE IF EXISTS "deal_creative_type_enum"');
    }
}
