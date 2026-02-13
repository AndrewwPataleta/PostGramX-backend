import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMtprotoPublicationVerificationColumns1761000000000
  implements MigrationInterface
{
  name = 'AddMtprotoPublicationVerificationColumns1761000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "deal_publications" ADD COLUMN IF NOT EXISTS "publishedMessageHash" text',
    );
    await queryRunner.query(
      'ALTER TABLE "deal_publications" ADD COLUMN IF NOT EXISTS "lastVerifiedAt" timestamptz',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "deal_publications" DROP COLUMN IF EXISTS "lastVerifiedAt"',
    );
    await queryRunner.query(
      'ALTER TABLE "deal_publications" DROP COLUMN IF EXISTS "publishedMessageHash"',
    );
  }
}
