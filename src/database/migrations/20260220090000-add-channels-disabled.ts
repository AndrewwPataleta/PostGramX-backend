import {MigrationInterface, QueryRunner} from 'typeorm';

export class AddChannelsDisabled20260220090000 implements MigrationInterface {
    name = 'AddChannelsDisabled20260220090000';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'ALTER TABLE "channels" ADD COLUMN IF NOT EXISTS "isDisabled" boolean NOT NULL DEFAULT false',
        );
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            'ALTER TABLE "channels" DROP COLUMN IF EXISTS "isDisabled"',
        );
    }
}
