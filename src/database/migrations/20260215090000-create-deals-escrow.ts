import {MigrationInterface, QueryRunner} from 'typeorm';

export class CreateDealsEscrow20260215090000 implements MigrationInterface {
    name = 'CreateDealsEscrow20260215090000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            "CREATE TYPE \"deals_escrow_status_enum\" AS ENUM('DRAFT', 'WAITING_SCHEDULE', 'WAITING_CREATIVE', 'CREATIVE_SUBMITTED', 'ADMIN_REVIEW', 'CHANGES_REQUESTED', 'AWAITING_PAYMENT', 'PAYMENT_AWAITING', 'FUNDS_CONFIRMED', 'SCHEDULED', 'POSTING', 'POSTED_VERIFYING', 'RELEASED', 'CANCELED', 'REFUNDED', 'DISPUTED')",
        );
        await queryRunner.query(
            "CREATE TYPE \"escrow_wallets_scope_enum\" AS ENUM('DEAL', 'USER')",
        );
        await queryRunner.query(
            "CREATE TYPE \"escrow_wallets_status_enum\" AS ENUM('ACTIVE', 'CLOSED', 'ROTATED')",
        );

        await queryRunner.query(`
            CREATE TABLE "deals" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "advertiserUserId" uuid NOT NULL,
                "channelOwnerUserId" uuid,
                "escrowStatus" "deals_escrow_status_enum" NOT NULL DEFAULT 'DRAFT',
                "escrowWalletId" uuid,
                "escrowAmountNano" bigint,
                "escrowCurrency" character varying NOT NULL DEFAULT 'TON',
                "escrowExpiresAt" TIMESTAMPTZ,
                "stalledAt" TIMESTAMPTZ,
                "lastActivityAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "cancelReason" text,
                "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT "PK_deals_id" PRIMARY KEY ("id")
            )
        `);

        await queryRunner.query(
            'CREATE INDEX "IDX_deals_escrow_status" ON "deals" ("escrowStatus")',
        );
        await queryRunner.query(
            'CREATE INDEX "IDX_deals_escrow_expires_at" ON "deals" ("escrowExpiresAt")',
        );
        await queryRunner.query(
            'CREATE INDEX "IDX_deals_last_activity_at" ON "deals" ("lastActivityAt")',
        );

        await queryRunner.query(`
            CREATE TABLE "escrow_wallets" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "scope" "escrow_wallets_scope_enum" NOT NULL,
                "dealId" uuid,
                "userId" uuid,
                "address" text NOT NULL,
                "status" "escrow_wallets_status_enum" NOT NULL DEFAULT 'ACTIVE',
                "provider" character varying NOT NULL DEFAULT 'TON',
                "metadata" jsonb,
                "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT "PK_escrow_wallets_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_escrow_wallets_deal_id" UNIQUE ("dealId"),
                CONSTRAINT "UQ_escrow_wallets_address" UNIQUE ("address")
            )
        `);

        await queryRunner.query(
            'CREATE INDEX "IDX_escrow_wallets_address" ON "escrow_wallets" ("address")',
        );

        await queryRunner.query(`
            CREATE TABLE "escrow_wallet_keys" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "walletId" uuid NOT NULL,
                "encryptedSecret" text NOT NULL,
                "keyVersion" integer NOT NULL DEFAULT 1,
                "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT "PK_escrow_wallet_keys_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_escrow_wallet_keys_wallet_id" UNIQUE ("walletId")
            )
        `);

        await queryRunner.query(
            'ALTER TABLE "transactions" ADD COLUMN "escrowWalletId" uuid',
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'ALTER TABLE "transactions" DROP COLUMN "escrowWalletId"',
        );
        await queryRunner.query('DROP TABLE "escrow_wallet_keys"');
        await queryRunner.query('DROP INDEX "IDX_escrow_wallets_address"');
        await queryRunner.query('DROP TABLE "escrow_wallets"');
        await queryRunner.query('DROP TABLE "deals"');
        await queryRunner.query('DROP TYPE "escrow_wallets_status_enum"');
        await queryRunner.query('DROP TYPE "escrow_wallets_scope_enum"');
        await queryRunner.query('DROP TYPE "deals_escrow_status_enum"');
    }
}
