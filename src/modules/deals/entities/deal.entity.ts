import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import {DealEscrowStatus} from '../types/deal-escrow-status.enum';

@Entity({name: 'deals'})
@Index('IDX_deals_escrow_status', ['escrowStatus'])
@Index('IDX_deals_escrow_expires_at', ['escrowExpiresAt'])
@Index('IDX_deals_last_activity_at', ['lastActivityAt'])
export class DealEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({type: 'uuid'})
    advertiserUserId: string;

    @Column({type: 'uuid', nullable: true})
    channelOwnerUserId: string | null;

    @Column({
        type: 'enum',
        enum: DealEscrowStatus,
        default: DealEscrowStatus.DRAFT,
    })
    escrowStatus: DealEscrowStatus;

    @Column({type: 'uuid', nullable: true})
    escrowWalletId: string | null;

    @Column({type: 'bigint', nullable: true})
    escrowAmountNano: string | null;

    @Column({default: 'TON'})
    escrowCurrency: string;

    @Column({type: 'timestamptz', nullable: true})
    escrowExpiresAt: Date | null;

    @Column({type: 'timestamptz', nullable: true})
    stalledAt: Date | null;

    @Column({type: 'timestamptz', default: () => 'now()'})
    lastActivityAt: Date;

    @Column({type: 'text', nullable: true})
    cancelReason: string | null;

    @CreateDateColumn({type: 'timestamptz'})
    createdAt: Date;

    @UpdateDateColumn({type: 'timestamptz'})
    updatedAt: Date;
}
