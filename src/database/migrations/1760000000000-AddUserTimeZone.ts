import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserTimeZone1760000000000 implements MigrationInterface {
  name = 'AddUserTimeZone1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "timeZone" character varying');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "users" DROP COLUMN IF EXISTS "timeZone"');
  }
}
