import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInitialSchema20260126190000
  implements MigrationInterface
{
  name = 'CreateInitialSchema20260126190000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await queryRunner.query(
      "CREATE TYPE \"admin_rule_type_enum\" AS ENUM('view', 'edit')",
    );
    await queryRunner.query(
      "CREATE TYPE \"channels_status_enum\" AS ENUM('DRAFT', 'PENDING_VERIFY', 'VERIFIED', 'FAILED', 'REVOKED')",
    );
    await queryRunner.query(
      "CREATE TYPE \"channel_memberships_role_enum\" AS ENUM('OWNER', 'MANAGER')",
    );
    await queryRunner.query(
      "CREATE TYPE \"channel_memberships_telegramAdminStatus_enum\" AS ENUM('creator', 'administrator')",
    );

    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "username" character varying,
        "email" character varying,
        "telegramId" character varying,
        "firstName" character varying,
        "lastName" character varying,
        "avatar" character varying,
        "lang" character varying,
        "isPremium" boolean NOT NULL DEFAULT false,
        "isActive" boolean NOT NULL DEFAULT false,
        "platformType" character varying,
        "authType" character varying,
        "fbPushToken" character varying,
        "lastLoginAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "admin_page" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "key" character varying NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_admin_page_key" UNIQUE ("key"),
        CONSTRAINT "PK_admin_page_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "admin_user" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" text NOT NULL,
        "login" text NOT NULL,
        "login_lowercase" text NOT NULL,
        "password_hash" text NOT NULL,
        "password_salt" text NOT NULL,
        "is_super" boolean NOT NULL DEFAULT false,
        "language" text NOT NULL DEFAULT 'en',
        "created_by_id" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_admin_user_login" UNIQUE ("login"),
        CONSTRAINT "UQ_admin_user_login_lowercase" UNIQUE ("login_lowercase"),
        CONSTRAINT "PK_admin_user_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "admin_rule" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" text NOT NULL,
        "type" "admin_rule_type_enum" NOT NULL DEFAULT 'view',
        "page_id" uuid NOT NULL,
        "created_by_id" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_admin_rule_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "admin_user_rules" (
        "admin_user_id" uuid NOT NULL,
        "admin_rule_id" uuid NOT NULL,
        CONSTRAINT "PK_admin_user_rules" PRIMARY KEY ("admin_user_id", "admin_rule_id")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_admin_user_rules_rule" ON "admin_user_rules" ("admin_rule_id")',
    );

    await queryRunner.query(`
      CREATE TABLE "channels" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "username" character varying(64) NOT NULL,
        "telegramChatId" bigint,
        "title" text NOT NULL,
        "status" "channels_status_enum" NOT NULL DEFAULT 'DRAFT',
        "createdByUserId" uuid NOT NULL,
        "verifiedAt" TIMESTAMPTZ,
        "lastCheckedAt" TIMESTAMPTZ,
        "memberCount" integer,
        "avgViews" integer,
        "languageStats" jsonb,
        "verificationErrorCode" character varying,
        "verificationErrorMessage" text,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_channels_username" UNIQUE ("username"),
        CONSTRAINT "UQ_channels_telegramChatId" UNIQUE ("telegramChatId"),
        CONSTRAINT "PK_channels_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_channels_username" ON "channels" ("username")',
    );

    await queryRunner.query(`
      CREATE TABLE "channel_memberships" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "channelId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "role" "channel_memberships_role_enum" NOT NULL,
        "telegramAdminStatus" "channel_memberships_telegramAdminStatus_enum",
        "permissionsSnapshot" jsonb,
        "isActive" boolean NOT NULL DEFAULT true,
        "lastRecheckAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_channel_memberships_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_channel_memberships_channel_user" UNIQUE ("channelId", "userId")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_channel_memberships_channel_id" ON "channel_memberships" ("channelId")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_channel_memberships_user_id" ON "channel_memberships" ("userId")',
    );

    await queryRunner.query(
      'ALTER TABLE "admin_user" ADD CONSTRAINT "FK_admin_user_created_by" FOREIGN KEY ("created_by_id") REFERENCES "admin_user"("id") ON DELETE SET NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "admin_rule" ADD CONSTRAINT "FK_admin_rule_page" FOREIGN KEY ("page_id") REFERENCES "admin_page"("id") ON DELETE CASCADE',
    );
    await queryRunner.query(
      'ALTER TABLE "admin_rule" ADD CONSTRAINT "FK_admin_rule_created_by" FOREIGN KEY ("created_by_id") REFERENCES "admin_user"("id") ON DELETE SET NULL',
    );
    await queryRunner.query(
      'ALTER TABLE "admin_user_rules" ADD CONSTRAINT "FK_admin_user_rules_user" FOREIGN KEY ("admin_user_id") REFERENCES "admin_user"("id") ON DELETE CASCADE',
    );
    await queryRunner.query(
      'ALTER TABLE "admin_user_rules" ADD CONSTRAINT "FK_admin_user_rules_rule" FOREIGN KEY ("admin_rule_id") REFERENCES "admin_rule"("id") ON DELETE CASCADE',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "admin_user_rules" DROP CONSTRAINT "FK_admin_user_rules_rule"',
    );
    await queryRunner.query(
      'ALTER TABLE "admin_user_rules" DROP CONSTRAINT "FK_admin_user_rules_user"',
    );
    await queryRunner.query(
      'ALTER TABLE "admin_rule" DROP CONSTRAINT "FK_admin_rule_created_by"',
    );
    await queryRunner.query(
      'ALTER TABLE "admin_rule" DROP CONSTRAINT "FK_admin_rule_page"',
    );
    await queryRunner.query(
      'ALTER TABLE "admin_user" DROP CONSTRAINT "FK_admin_user_created_by"',
    );
    await queryRunner.query(
      'DROP INDEX "IDX_channel_memberships_user_id"',
    );
    await queryRunner.query(
      'DROP INDEX "IDX_channel_memberships_channel_id"',
    );
    await queryRunner.query('DROP TABLE "channel_memberships"');
    await queryRunner.query('DROP INDEX "IDX_channels_username"');
    await queryRunner.query('DROP TABLE "channels"');
    await queryRunner.query('DROP INDEX "IDX_admin_user_rules_rule"');
    await queryRunner.query('DROP TABLE "admin_user_rules"');
    await queryRunner.query('DROP TABLE "admin_rule"');
    await queryRunner.query('DROP TABLE "admin_user"');
    await queryRunner.query('DROP TABLE "admin_page"');
    await queryRunner.query('DROP TABLE "users"');
    await queryRunner.query('DROP TYPE "channel_memberships_telegramAdminStatus_enum"');
    await queryRunner.query('DROP TYPE "channel_memberships_role_enum"');
    await queryRunner.query('DROP TYPE "channels_status_enum"');
    await queryRunner.query('DROP TYPE "admin_rule_type_enum"');
  }
}
