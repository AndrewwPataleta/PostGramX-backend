import {MigrationInterface, QueryRunner} from 'typeorm';

export class AddDealTimeouts20260401090000 implements MigrationInterface {
    name = 'AddDealTimeouts20260401090000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'ALTER TABLE "deals" ADD COLUMN "idleExpiresAt" timestamptz',
        );
        await queryRunner.query(
            'ALTER TABLE "deals" ADD COLUMN "creativeDeadlineAt" timestamptz',
        );
        await queryRunner.query(
            'ALTER TABLE "deals" ADD COLUMN "adminReviewDeadlineAt" timestamptz',
        );
        await queryRunner.query(
            'ALTER TABLE "deals" ADD COLUMN "paymentDeadlineAt" timestamptz',
        );
        await queryRunner.query(
            'ALTER TABLE "deals" ADD COLUMN "adminReviewNotifiedAt" timestamptz',
        );

        await queryRunner.query(
            'CREATE INDEX "IDX_deals_idle_expires_at" ON "deals" ("idleExpiresAt")',
        );
        await queryRunner.query(
            'CREATE INDEX "IDX_deals_creative_deadline" ON "deals" ("creativeDeadlineAt")',
        );
        await queryRunner.query(
            'CREATE INDEX "IDX_deals_admin_deadline" ON "deals" ("adminReviewDeadlineAt")',
        );
        await queryRunner.query(
            'CREATE INDEX "IDX_deals_payment_deadline" ON "deals" ("paymentDeadlineAt")',
        );

        await queryRunner.query(
            "CREATE TYPE \"deal_reminder_type_enum\" AS ENUM('CREATIVE_DEADLINE', 'ADMIN_DEADLINE', 'PAYMENT_DEADLINE', 'IDLE_EXPIRE')",
        );
        await queryRunner.query(
            `CREATE TABLE "deal_reminders" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "dealId" uuid NOT NULL,
                "type" "deal_reminder_type_enum" NOT NULL,
                "sentAt" timestamptz NOT NULL,
                "createdAt" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "PK_deal_reminders_id" PRIMARY KEY ("id")
            )`,
        );
        await queryRunner.query(
            'CREATE INDEX "IDX_deal_reminders_deal_id" ON "deal_reminders" ("dealId")',
        );
        await queryRunner.query(
            'CREATE UNIQUE INDEX "UQ_deal_reminders_deal_type" ON "deal_reminders" ("dealId", "type")',
        );
        await queryRunner.query(
            'ALTER TABLE "deal_reminders" ADD CONSTRAINT "FK_deal_reminders_deal" FOREIGN KEY ("dealId") REFERENCES "deals"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'ALTER TABLE "deal_reminders" DROP CONSTRAINT "FK_deal_reminders_deal"',
        );
        await queryRunner.query('DROP INDEX "UQ_deal_reminders_deal_type"');
        await queryRunner.query('DROP INDEX "IDX_deal_reminders_deal_id"');
        await queryRunner.query('DROP TABLE "deal_reminders"');
        await queryRunner.query('DROP TYPE "deal_reminder_type_enum"');

        await queryRunner.query('DROP INDEX "IDX_deals_payment_deadline"');
        await queryRunner.query('DROP INDEX "IDX_deals_admin_deadline"');
        await queryRunner.query('DROP INDEX "IDX_deals_creative_deadline"');
        await queryRunner.query('DROP INDEX "IDX_deals_idle_expires_at"');

        await queryRunner.query(
            'ALTER TABLE "deals" DROP COLUMN "adminReviewNotifiedAt"',
        );
        await queryRunner.query(
            'ALTER TABLE "deals" DROP COLUMN "paymentDeadlineAt"',
        );
        await queryRunner.query(
            'ALTER TABLE "deals" DROP COLUMN "adminReviewDeadlineAt"',
        );
        await queryRunner.query(
            'ALTER TABLE "deals" DROP COLUMN "creativeDeadlineAt"',
        );
        await queryRunner.query(
            'ALTER TABLE "deals" DROP COLUMN "idleExpiresAt"',
        );
    }
}
