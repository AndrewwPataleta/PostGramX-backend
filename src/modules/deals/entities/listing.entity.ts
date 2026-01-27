import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import {ListingStatus} from '../types/listing-status.enum';

@Entity({name: 'listings'})
@Index('IDX_listings_channel_status', ['channelId', 'status'])
export class ListingEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({type: 'uuid'})
    channelId: string;

    @Column({type: 'uuid'})
    createdByUserId: string;

    @Column({type: 'text', nullable: true})
    title: string | null;

    @Column({type: 'bigint'})
    priceNano: string;

    @Column({default: 'TON'})
    currency: string;

    @Column({default: 'post'})
    format: string;

    @Column({type: 'integer', nullable: true})
    placementHours: number | null;

    @Column({type: 'integer', nullable: true})
    lifetimeHours: number | null;

    @Column({default: false})
    allowPostEdit: boolean;

    @Column({type: 'text', array: true, default: () => "'{}'"})
    tags: string[];

    @Column({
        type: 'enum',
        enum: ListingStatus,
        enumName: 'listings_status_enum',
        default: ListingStatus.ACTIVE,
    })
    status: ListingStatus;

    @CreateDateColumn({type: 'timestamptz'})
    createdAt: Date;

    @UpdateDateColumn({type: 'timestamptz'})
    updatedAt: Date;
}
