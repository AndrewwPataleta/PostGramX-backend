import {MigrationInterface, QueryRunner} from 'typeorm';

export class AddTonWatcherSafety20250212120000 implements MigrationInterface {
    name = 'AddTonWatcherSafety20250212120000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'ALTER TABLE "deal_escrows" ADD COLUMN "lastSeenLt" text',
        );
        await queryRunner.query(
            'ALTER TABLE "deal_escrows" ADD COLUMN "lastSeenTxHash" text',
        );

        await queryRunner.query(
            'ALTER TABLE "transactions" ADD COLUMN "expectedObservedAfter" timestamptz',
        );
        await queryRunner.query(
            'ALTER TABLE "transactions" ADD COLUMN "expectedObservedBefore" timestamptz',
        );

        await queryRunner.query(
            'DROP INDEX IF EXISTS "UQ_transactions_external_tx_hash"',
        );
        await queryRunner.query(
            'CREATE UNIQUE INDEX "UQ_transactions_external_tx_hash_currency" ON "transactions" ("externalTxHash", "currency") WHERE "externalTxHash" IS NOT NULL',
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'DROP INDEX IF EXISTS "UQ_transactions_external_tx_hash_currency"',
        );
        await queryRunner.query(
            'CREATE UNIQUE INDEX "UQ_transactions_external_tx_hash" ON "transactions" ("externalTxHash")',
        );

        await queryRunner.query(
            'ALTER TABLE "transactions" DROP COLUMN "expectedObservedBefore"',
        );
        await queryRunner.query(
            'ALTER TABLE "transactions" DROP COLUMN "expectedObservedAfter"',
        );

        await queryRunner.query(
            'ALTER TABLE "deal_escrows" DROP COLUMN "lastSeenTxHash"',
        );
        await queryRunner.query(
            'ALTER TABLE "deal_escrows" DROP COLUMN "lastSeenLt"',
        );
    }
}
