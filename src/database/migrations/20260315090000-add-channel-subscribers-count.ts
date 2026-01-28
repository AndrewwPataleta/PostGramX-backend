import {MigrationInterface, QueryRunner} from 'typeorm';

export class AddChannelSubscribersCount20260315090000
    implements MigrationInterface
{
    name = 'AddChannelSubscribersCount20260315090000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'ALTER TABLE "channels" ADD COLUMN "subscribersCount" integer',
        );
        await queryRunner.query(
            'CREATE INDEX "IDX_channels_subscribers_count" ON "channels" ("subscribersCount")',
        );
        await queryRunner.query(
            'UPDATE "channels" SET "subscribersCount" = "memberCount" WHERE "subscribersCount" IS NULL AND "memberCount" IS NOT NULL',
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'DROP INDEX "IDX_channels_subscribers_count"',
        );
        await queryRunner.query(
            'ALTER TABLE "channels" DROP COLUMN "subscribersCount"',
        );
    }
}
