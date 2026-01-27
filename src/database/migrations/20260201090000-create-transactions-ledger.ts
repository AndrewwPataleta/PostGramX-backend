import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTransactionsLedger20260201090000
  implements MigrationInterface
{
  name = 'CreateTransactionsLedger20260201090000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "CREATE TYPE \"transactions_type_enum\" AS ENUM('DEPOSIT', 'WITHDRAW', 'ESCROW_HOLD', 'ESCROW_RELEASE', 'ESCROW_REFUND', 'FEE')",
    );
    await queryRunner.query(
      "CREATE TYPE \"transactions_direction_enum\" AS ENUM('IN', 'OUT', 'INTERNAL')",
    );
    await queryRunner.query(
      "CREATE TYPE \"transactions_status_enum\" AS ENUM('PENDING', 'AWAITING_CONFIRMATION', 'CONFIRMED', 'COMPLETED', 'FAILED', 'CANCELED')",
    );
    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "type" "transactions_type_enum" NOT NULL,
        "direction" "transactions_direction_enum" NOT NULL,
        "status" "transactions_status_enum" NOT NULL,
        "amountNano" bigint NOT NULL,
        "currency" character varying NOT NULL DEFAULT 'TON',
        "description" text,
        "dealId" uuid,
        "channelId" uuid,
        "counterpartyUserId" uuid,
        "depositAddress" text,
        "externalTxHash" text,
        "externalExplorerUrl" text,
        "errorCode" text,
        "errorMessage" text,
        "metadata" jsonb,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "confirmedAt" TIMESTAMPTZ,
        "completedAt" TIMESTAMPTZ,
        CONSTRAINT "PK_transactions_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_transactions_external_tx_hash" ON "transactions" ("externalTxHash")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_transactions_user_created_at" ON "transactions" ("userId", "createdAt" DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_transactions_deal_id" ON "transactions" ("dealId")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_transactions_status" ON "transactions" ("status")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_transactions_type" ON "transactions" ("type")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "IDX_transactions_type"',
    );
    await queryRunner.query(
      'DROP INDEX "IDX_transactions_status"',
    );
    await queryRunner.query(
      'DROP INDEX "IDX_transactions_deal_id"',
    );
    await queryRunner.query(
      'DROP INDEX "IDX_transactions_user_created_at"',
    );
    await queryRunner.query(
      'DROP INDEX "UQ_transactions_external_tx_hash"',
    );
    await queryRunner.query('DROP TABLE "transactions"');
    await queryRunner.query('DROP TYPE "transactions_status_enum"');
    await queryRunner.query('DROP TYPE "transactions_direction_enum"');
    await queryRunner.query('DROP TYPE "transactions_type_enum"');
  }
}
