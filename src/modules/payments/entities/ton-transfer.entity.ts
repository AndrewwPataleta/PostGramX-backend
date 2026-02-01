import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import {CurrencyCode} from '../../../common/constants/currency/currency.constants';
import {TransactionEntity} from './transaction.entity';

@Entity({name: 'ton_transfers'})
@Index('UQ_ton_transfers_tx_hash_network', ['txHash', 'network'], {unique: true})
@Index('IDX_ton_transfers_to_address', ['toAddress'])
@Index('IDX_ton_transfers_transaction_id', ['transactionId'])
export class TonTransferEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({type: 'uuid'})
    transactionId: string;

    @Column({
        type: 'enum',
        enum: CurrencyCode,
        enumName: 'ton_transfers_network_enum',
        default: CurrencyCode.TON,
    })
    network: CurrencyCode;

    @Column({type: 'text'})
    toAddress: string;

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

    @ManyToOne(() => TransactionEntity, {onDelete: 'CASCADE'})
    @JoinColumn({name: 'transactionId'})
    transaction: TransactionEntity;
}
