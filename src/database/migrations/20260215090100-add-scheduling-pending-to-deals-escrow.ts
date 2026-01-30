import {MigrationInterface, QueryRunner} from 'typeorm';

export class AddSchedulingPendingToDealsEscrow20260215090100
    implements MigrationInterface
{
    name = 'AddSchedulingPendingToDealsEscrow20260215090100';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            "ALTER TYPE \"deals_escrow_status_enum\" ADD VALUE IF NOT EXISTS 'SCHEDULING_PENDING'",
        );
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // Postgres does not support dropping enum values safely.
    }
}
