import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import {PreDealParticipantRole} from '../types/predeal-participant-role.enum';

@Entity({name: 'pre_deal_participants'})
@Index('IDX_pre_deal_participants_pre_deal_id', ['preDealId'])
@Index('IDX_pre_deal_participants_user_id', ['userId'])
@Index('IDX_pre_deal_participants_user_active', ['userId', 'isActive'])
@Index('IDX_pre_deal_participants_pre_deal_user_role', [
    'preDealId',
    'userId',
    'role',
], {unique: true})
export class PreDealParticipantEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({type: 'uuid'})
    preDealId: string;

    @Column({type: 'uuid'})
    userId: string;

    @Column({
        type: 'enum',
        enum: PreDealParticipantRole,
        enumName: 'pre_deal_participant_role_enum',
    })
    role: PreDealParticipantRole;

    @Column({type: 'text', nullable: true})
    telegramUserId: string | null;

    @Column({type: 'text', nullable: true})
    telegramChatId: string | null;

    @Column({default: false})
    isActive: boolean;

    @CreateDateColumn({type: 'timestamptz'})
    createdAt: Date;

    @UpdateDateColumn({type: 'timestamptz'})
    updatedAt: Date;
}
