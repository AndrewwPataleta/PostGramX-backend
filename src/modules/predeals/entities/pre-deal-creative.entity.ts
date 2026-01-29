import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({name: 'pre_deal_creatives'})
@Index('IDX_pre_deal_creatives_pre_deal_id', ['preDealId'])
export class PreDealCreativeEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({type: 'uuid'})
    preDealId: string;

    @Column({type: 'uuid'})
    fromUserId: string;

    @Column({type: 'text'})
    telegramChatId: string;

    @Column({type: 'bigint'})
    telegramMessageId: string;

    @Column({type: 'text', nullable: true})
    text: string | null;

    @Column({type: 'jsonb', nullable: true})
    attachments: Array<Record<string, unknown>> | null;

    @CreateDateColumn({type: 'timestamptz'})
    createdAt: Date;
}
