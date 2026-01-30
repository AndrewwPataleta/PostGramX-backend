import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import {TransactionDirection} from '../types/transaction-direction.enum';
import {TransactionStatus} from '../types/transaction-status.enum';
import {TransactionType} from '../types/transaction-type.enum';

@Entity({name: 'transactions'})
@Index('IDX_transactions_user_created_at', ['userId', 'createdAt'])
@Index('IDX_transactions_deal_type', ['dealId', 'type'])
@Index('IDX_transactions_deal_id', ['dealId'])
@Index('IDX_transactions_status', ['status'])
@Index('IDX_transactions_type', ['type'])
@Index('UQ_transactions_external_tx_hash', ['externalTxHash'], {unique: true})
export class TransactionEntity extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({type: 'uuid'})
    userId: string;

    @Column({type: 'enum', enum: TransactionType})
    type: TransactionType;

    @Column({type: 'enum', enum: TransactionDirection})
    direction: TransactionDirection;

    @Column({type: 'enum', enum: TransactionStatus})
    status: TransactionStatus;

    @Column({type: 'bigint'})
    amountNano: string;

    @Column({default: 'TON'})
    currency: string;

    @Column({type: 'text', nullable: true})
    description: string | null;

    @Column({type: 'uuid', nullable: true})
    dealId: string | null;

    @Column({type: 'uuid', nullable: true})
    escrowWalletId: string | null;

    @Column({type: 'uuid', nullable: true})
    channelId: string | null;

    @Column({type: 'uuid', nullable: true})
    counterpartyUserId: string | null;

    @Column({type: 'text', nullable: true})
    depositAddress: string | null;

    @Column({type: 'text', nullable: true})
    externalTxHash: string | null;

    @Column({type: 'text', nullable: true})
    externalExplorerUrl: string | null;

    @Column({type: 'text', nullable: true})
    errorCode: string | null;

    @Column({type: 'text', nullable: true})
    errorMessage: string | null;

    @Column({type: 'jsonb', nullable: true})
    metadata: Record<string, unknown> | null;

    @CreateDateColumn({type: 'timestamptz'})
    createdAt: Date;

    @UpdateDateColumn({type: 'timestamptz'})
    updatedAt: Date;

    @Column({type: 'timestamptz', nullable: true})
    confirmedAt: Date | null;

    @Column({type: 'timestamptz', nullable: true})
    completedAt: Date | null;
}
