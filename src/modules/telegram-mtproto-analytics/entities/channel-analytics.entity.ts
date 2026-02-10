import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({name: 'channel_analytics'})
@Index('IDX_channel_analytics_channel_collected', ['channelId', 'collectedAt'])
export class ChannelAnalyticsEntity extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({type: 'uuid'})
    channelId: string;

    @Column({type: 'timestamptz'})
    collectedAt: Date;

    @Column({type: 'integer', nullable: true})
    subscribersCount: number | null;

    @Column({type: 'integer', nullable: true})
    avgViews: number | null;

    @Column({type: 'integer', nullable: true})
    avgForwards: number | null;

    @Column({type: 'integer', nullable: true})
    avgReactions: number | null;

    @Column({type: 'integer'})
    postsSampleSize: number;

    @Column({type: 'bigint', nullable: true})
    lastPostId: string | null;

    @Column({type: 'jsonb', nullable: true})
    lastPostsPreview: Array<Record<string, unknown>> | null;

    @Column({type: 'jsonb', nullable: true})
    rawMeta: Record<string, unknown> | null;

    @CreateDateColumn({type: 'timestamptz'})
    createdAt: Date;
}
