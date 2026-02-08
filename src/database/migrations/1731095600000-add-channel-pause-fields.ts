import {MigrationInterface, QueryRunner, TableColumn} from 'typeorm';

export class AddChannelPauseFields1731095600000 implements MigrationInterface {
    name = 'AddChannelPauseFields1731095600000';

    async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumns('channels', [
            new TableColumn({
                name: 'isPaused',
                type: 'boolean',
                isNullable: false,
                default: false,
            }),
            new TableColumn({
                name: 'pausedAt',
                type: 'timestamptz',
                isNullable: true,
            }),
            new TableColumn({
                name: 'pausedByUserId',
                type: 'uuid',
                isNullable: true,
            }),
        ]);
    }

    async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('channels', 'pausedByUserId');
        await queryRunner.dropColumn('channels', 'pausedAt');
        await queryRunner.dropColumn('channels', 'isPaused');
    }
}
