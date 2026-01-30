import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    ManyToOne,
    PrimaryGeneratedColumn,
    JoinColumn,
} from 'typeorm';
import {DealEntity} from './deal.entity';
import {DealReminderType} from '../types/deal-reminder-type.enum';

@Entity({name: 'deal_reminders'})
@Index('IDX_deal_reminders_deal_id', ['dealId'])
@Index('UQ_deal_reminders_deal_type', ['dealId', 'type'], {unique: true})
export class DealReminderEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({type: 'uuid'})
    dealId: string;

    @ManyToOne(() => DealEntity, {onDelete: 'CASCADE'})
    @JoinColumn({name: 'dealId'})
    deal: DealEntity;

    @Column({
        type: 'enum',
        enum: DealReminderType,
        enumName: 'deal_reminder_type_enum',
    })
    type: DealReminderType;

    @Column({type: 'timestamptz'})
    sentAt: Date;

    @CreateDateColumn({type: 'timestamptz'})
    createdAt: Date;
}
