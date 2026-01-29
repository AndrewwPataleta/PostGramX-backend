import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import {PreDealStatus} from '../types/predeal-status.enum';
import {PreDealListingSnapshot} from '../types/predeal-listing-snapshot.type';

@Entity({name: 'pre_deals'})
@Index('IDX_pre_deals_advertiser_status', ['advertiserUserId', 'status'])
@Index('IDX_pre_deals_listing_id', ['listingId'])
@Index('IDX_pre_deals_channel_id', ['channelId'])
@Index('IDX_pre_deals_last_activity_at', ['lastActivityAt'])
export class PreDealEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({type: 'uuid'})
    listingId: string;

    @Column({type: 'uuid'})
    channelId: string;

    @Column({type: 'uuid'})
    advertiserUserId: string;

    @Column({type: 'uuid', nullable: true})
    dealId: string | null;

    @Column({
        type: 'enum',
        enum: PreDealStatus,
        enumName: 'pre_deals_status_enum',
        default: PreDealStatus.DRAFT,
    })
    status: PreDealStatus;

    @Column({type: 'timestamptz'})
    scheduledAt: Date;

    @Column({type: 'integer', nullable: true})
    paymentWindowSeconds: number | null;

    @Column({type: 'timestamptz', nullable: true})
    paymentExpiresAt: Date | null;

    @Column({type: 'timestamptz', nullable: true})
    advertiserConfirmedAt: Date | null;

    @Column({type: 'timestamptz', nullable: true})
    publisherApprovedAt: Date | null;

    @Column({type: 'timestamptz', nullable: true})
    publisherRejectedAt: Date | null;

    @Column({type: 'text', nullable: true})
    publisherDecisionByTelegramId: string | null;

    @Column({type: 'text', nullable: true})
    rejectReason: string | null;

    @Column({type: 'bigint', nullable: true})
    expectedAmountNano: string | null;

    @Column({type: 'jsonb', default: () => "'{}'"})
    listingSnapshot: PreDealListingSnapshot;

    @Column({type: 'timestamptz', default: () => 'now()'})
    lastActivityAt: Date;

    @Column({type: 'timestamptz', nullable: true})
    expiresAt: Date | null;

    @CreateDateColumn({type: 'timestamptz'})
    createdAt: Date;

    @UpdateDateColumn({type: 'timestamptz'})
    updatedAt: Date;
}
