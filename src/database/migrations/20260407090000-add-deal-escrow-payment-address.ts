import {MigrationInterface, QueryRunner} from 'typeorm';

export class AddDealEscrowPaymentAddress20260407090000
    implements MigrationInterface
{
    name = 'AddDealEscrowPaymentAddress20260407090000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "deals"
            ADD COLUMN IF NOT EXISTS "escrowPaymentAddress" text
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "deals"
            DROP COLUMN IF EXISTS "escrowPaymentAddress"
        `);
    }
}
