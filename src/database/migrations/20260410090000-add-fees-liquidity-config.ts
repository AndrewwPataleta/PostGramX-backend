import {MigrationInterface, QueryRunner} from 'typeorm';

export class AddFeesLiquidityConfig20260410090000
    implements MigrationInterface
{
    name = 'AddFeesLiquidityConfig20260410090000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "fees_config" (
                "id" smallint NOT NULL DEFAULT 1,
                "feesEnabled" boolean NOT NULL DEFAULT true,
                "payoutServiceFeeMode" text NOT NULL DEFAULT 'BPS',
                "payoutServiceFeeFixedNano" bigint NOT NULL DEFAULT '0',
                "payoutServiceFeeBps" bigint NOT NULL DEFAULT '50',
                "payoutServiceFeeMinNano" bigint NOT NULL DEFAULT '0',
                "payoutServiceFeeMaxNano" bigint,
                "payoutNetworkFeeMode" text NOT NULL DEFAULT 'FIXED',
                "payoutNetworkFeeFixedNano" bigint NOT NULL DEFAULT '5000000',
                "payoutNetworkFeeMinNano" bigint NOT NULL DEFAULT '0',
                "payoutNetworkFeeMaxNano" bigint,
                "payoutMinNetAmountNano" bigint,
                "feeRevenueStrategy" text NOT NULL DEFAULT 'LEDGER_ONLY',
                "feeRevenueAddress" text,
                "createdAt" timestamptz NOT NULL DEFAULT now(),
                "updatedAt" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "PK_fees_config_id" PRIMARY KEY ("id"),
                CONSTRAINT "CHK_fees_config_singleton" CHECK ("id" = 1)
            )
        `);

        await queryRunner.query(`
            INSERT INTO "fees_config" ("id")
            VALUES (1)
            ON CONFLICT ("id") DO NOTHING
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "liquidity_config" (
                "id" smallint NOT NULL DEFAULT 1,
                "sweepMaxGasReserveNano" bigint NOT NULL DEFAULT '50000000',
                "sweepMinWithdrawNano" bigint NOT NULL DEFAULT '20000000',
                "createdAt" timestamptz NOT NULL DEFAULT now(),
                "updatedAt" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "PK_liquidity_config_id" PRIMARY KEY ("id"),
                CONSTRAINT "CHK_liquidity_config_singleton" CHECK ("id" = 1)
            )
        `);

        await queryRunner.query(`
            INSERT INTO "liquidity_config" ("id")
            VALUES (1)
            ON CONFLICT ("id") DO NOTHING
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE IF EXISTS "liquidity_config"');
        await queryRunner.query('DROP TABLE IF EXISTS "fees_config"');
    }
}
