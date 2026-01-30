import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
} from 'typeorm';
import {DealCreativeType} from '../types/deal-creative-type.enum';

@Entity({name: 'deal_creatives'})
@Index('UQ_deal_creatives_deal_id', ['dealId'], {unique: true})
@Index('IDX_deal_creatives_created_at', ['createdAt'])
export class DealCreativeEntity extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({type: 'uuid'})
    dealId: string;

    @Column({
        type: 'enum',
        enum: DealCreativeType,
        enumName: 'deal_creative_type_enum',
    })
    type: DealCreativeType;

    @Column({type: 'text', nullable: true})
    text: string | null;

    @Column({type: 'text', nullable: true})
    mediaFileId: string | null;

    @Column({type: 'text', nullable: true})
    caption: string | null;

    @Column({type: 'jsonb', nullable: true})
    rawPayload: Record<string, unknown> | null;

    @CreateDateColumn({type: 'timestamptz'})
    createdAt: Date;
}
