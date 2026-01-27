import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import {ChannelEntity} from '../../channels/entities/channel.entity';
import {User} from '../../auth/entities/user.entity';

export enum ListingFormat {
    POST = 'POST',
}

@Entity({name: 'listings'})
@Index('IDX_listings_channel_active', ['channelId', 'isActive'])
@Index('IDX_listings_created_by_created_at', ['createdByUserId', 'createdAt'])
export class ListingEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({type: 'uuid'})
    channelId: string;

    @Column({type: 'uuid'})
    createdByUserId: string;

    @ManyToOne(() => ChannelEntity, {nullable: true})
    @JoinColumn({name: 'channelId'})
    channel: ChannelEntity | null;

    @ManyToOne(() => User, {nullable: true})
    @JoinColumn({name: 'createdByUserId'})
    createdByUser: User | null;

    @Column({type: 'text'})
    format: ListingFormat;

    @Column({type: 'bigint'})
    priceNano: string;

    @Column({type: 'text', default: 'TON'})
    currency: string;

    @Column({type: 'timestamptz'})
    availabilityFrom: Date;

    @Column({type: 'timestamptz'})
    availabilityTo: Date;

    @Column({type: 'integer', nullable: true})
    pinDurationHours: number | null;

    @Column({type: 'integer'})
    visibilityDurationHours: number;

    @Column({default: false})
    allowEdits: boolean;

    @Column({default: false})
    allowLinkTracking: boolean;

    @Column({default: false})
    allowPinnedPlacement: boolean;

    @Column({default: true})
    requiresApproval: boolean;

    @Column({default: true})
    isActive: boolean;

    @Column({type: 'text', default: ''})
    contentRulesText: string;

    @Column({type: 'text', array: true, default: () => "'{}'"})
    tags: string[];

    @CreateDateColumn({type: 'timestamptz'})
    createdAt: Date;

    @UpdateDateColumn({type: 'timestamptz'})
    updatedAt: Date;
}
