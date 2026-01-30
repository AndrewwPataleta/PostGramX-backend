import {MigrationInterface, QueryRunner} from 'typeorm';

export class AddTonTransfersAndReceived20260408090000
    implements MigrationInterface
{
    name = 'AddTonTransfersAndReceived20260408090000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transactions_status_enum') THEN
                    ALTER TYPE "transactions_status_enum" ADD VALUE IF NOT EXISTS 'PARTIAL';
                END IF;
            END $$;
        `);

        await queryRunner.query(`
            ALTER TABLE "transactions"
            ADD COLUMN IF NOT EXISTS "receivedNano" bigint NOT NULL DEFAULT '0'
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "ton_transfers" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "transactionId" uuid,
                "dealId" uuid,
                "depositAddress" text NOT NULL,
                "fromAddress" text NOT NULL,
                "amountNano" bigint NOT NULL,
                "txHash" text NOT NULL,
                "observedAt" TIMESTAMPTZ NOT NULL,
                "raw" jsonb NOT NULL DEFAULT '{}',
                "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT "PK_ton_transfers_id" PRIMARY KEY ("id"),
                CONSTRAINT "IDX_ton_transfers_txhash_unique" UNIQUE ("txHash")
            )
        `);

        await queryRunner.query(
            'CREATE INDEX IF NOT EXISTS "IDX_ton_transfers_depositAddress" ON "ton_transfers" ("depositAddress")',
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'DROP INDEX IF EXISTS "IDX_ton_transfers_depositAddress"',
        );
        await queryRunner.query('DROP TABLE IF EXISTS "ton_transfers"');
        await queryRunner.query(
            'ALTER TABLE "transactions" DROP COLUMN IF EXISTS "receivedNano"',
        );
    }
}
