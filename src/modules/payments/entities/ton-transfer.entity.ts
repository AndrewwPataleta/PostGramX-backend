import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({name: 'ton_transfers'})
@Index('IDX_ton_transfers_txhash_unique', ['txHash'], {unique: true})
@Index('IDX_ton_transfers_depositAddress', ['depositAddress'])
export class TonTransferEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({type: 'uuid', nullable: true})
    transactionId: string | null;

    @Column({type: 'uuid', nullable: true})
    dealId: string | null;

    @Column({type: 'text'})
    depositAddress: string;

    @Column({type: 'text'})
    fromAddress: string;

    @Column({type: 'bigint'})
    amountNano: string;

    @Column({type: 'text'})
    txHash: string;

    @Column({type: 'timestamptz'})
    observedAt: Date;

    @Column({type: 'jsonb', default: () => "'{}'"})
    raw: Record<string, unknown>;

    @CreateDateColumn({type: 'timestamptz'})
    createdAt: Date;
}
