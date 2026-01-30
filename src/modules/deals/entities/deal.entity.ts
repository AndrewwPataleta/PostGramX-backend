import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import {DealEscrowStatus} from '../types/deal-escrow-status.enum';
import {DealInitiatorSide} from '../types/deal-initiator-side.enum';
import {DealStatus} from '../types/deal-status.enum';
import {ListingEntity} from '../../listings/entities/listing.entity';
import {ChannelEntity} from '../../channels/entities/channel.entity';
import {DealListingSnapshot} from '../types/deal-listing-snapshot.type';

@Entity({name: 'deals'})
@Index('IDX_deals_advertiser_status', ['advertiserUserId', 'status'])
@Index('IDX_deals_publisher_status', ['publisherOwnerUserId', 'status'])
@Index('IDX_deals_listing_id', ['listingId'])
@Index('IDX_deals_channel_id', ['channelId'])
@Index('IDX_deals_escrow_status', ['escrowStatus'])
@Index('IDX_deals_escrow_expires_at', ['escrowExpiresAt'])
@Index('IDX_deals_last_activity_at', ['lastActivityAt'])
export class DealEntity extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({type: 'uuid'})
    advertiserUserId: string;

    @Column({type: 'uuid', nullable: true})
    publisherOwnerUserId: string | null;

    @Column({type: 'uuid', nullable: true})
    createdByUserId: string | null;

    @Column({type: 'uuid', nullable: true})
    listingId: string | null;

    @Column({type: 'uuid', nullable: true})
    channelId: string | null;

    @ManyToOne(() => ListingEntity, {nullable: true})
    @JoinColumn({name: 'listingId'})
    listing: ListingEntity | null;

    @ManyToOne(() => ChannelEntity, {nullable: true})
    @JoinColumn({name: 'channelId'})
    channel: ChannelEntity | null;

    @Column({
        type: 'enum',
        enum: DealInitiatorSide,
        enumName: 'deals_side_initiator_enum',
        nullable: true,
    })
    sideInitiator: DealInitiatorSide | null;

    @Column({
        type: 'enum',
        enum: DealStatus,
        enumName: 'deals_status_enum',
        default: DealStatus.PENDING,
    })
    status: DealStatus;

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

    @Column({type: 'jsonb', nullable: true})
    offerSnapshot: Record<string, unknown> | null;

    @Column({type: 'jsonb', default: () => "'{}'"})
    listingSnapshot: DealListingSnapshot;

    @Column({type: 'text', nullable: true})
    brief: string | null;

    @Column({type: 'timestamptz', nullable: true})
    scheduledAt: Date | null;

    @Column({type: 'text', nullable: true})
    cancelReason: string | null;

    @CreateDateColumn({type: 'timestamptz'})
    createdAt: Date;

    @UpdateDateColumn({type: 'timestamptz'})
    updatedAt: Date;
}

export interface DealEntity {
    sideInitiator: DealInitiatorSide | null;
}
