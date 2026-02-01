import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    OneToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import {PublicationStatus} from '../../../common/constants/deals/publication-status.constants';
import {DealEntity} from './deal.entity';

@Entity({name: 'deal_publications'})
@Index('IDX_deal_publications_status', ['status'])
@Index('IDX_deal_publications_must_remain', ['mustRemainUntil'])
@Index('UQ_deal_publications_deal_id', ['dealId'], {unique: true})
export class DealPublicationEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({type: 'uuid'})
    dealId: string;

    @Column({
        type: 'enum',
        enum: PublicationStatus,
        enumName: 'deal_publications_status_enum',
        default: PublicationStatus.NOT_POSTED,
    })
    status: PublicationStatus;

    @Column({type: 'bigint', nullable: true})
    publishedMessageId: string | null;

    @Column({type: 'timestamptz', nullable: true})
    publishedAt: Date | null;

    @Column({type: 'timestamptz', nullable: true})
    mustRemainUntil: Date | null;

    @Column({type: 'timestamptz', nullable: true})
    verifiedAt: Date | null;

    @Column({type: 'timestamptz', nullable: true})
    lastCheckedAt: Date | null;

    @Column({type: 'text', nullable: true})
    error: string | null;

    @CreateDateColumn({type: 'timestamptz'})
    createdAt: Date;

    @UpdateDateColumn({type: 'timestamptz'})
    updatedAt: Date;

    @OneToOne(() => DealEntity, (deal) => deal.publication, {onDelete: 'CASCADE'})
    @JoinColumn({name: 'dealId'})
    deal: DealEntity;
}
