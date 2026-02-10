import {
    BaseEntity,
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity({name: 'telegram_mtproto_sessions'})
@Index('IDX_mtproto_sessions_user_label', ['userId', 'label'], {unique: true})
export class TelegramMtprotoSessionEntity extends BaseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({type: 'uuid', nullable: true})
    userId: string | null;

    @Column({type: 'text'})
    label: string;

    @Column({type: 'text'})
    encryptedSession: string;

    @Column({default: true})
    isActive: boolean;

    @Column({type: 'timestamptz', nullable: true})
    lastCheckedAt: Date | null;

    @Column({type: 'text', nullable: true})
    lastErrorCode: string | null;

    @Column({type: 'text', nullable: true})
    lastErrorMessage: string | null;

    @CreateDateColumn({type: 'timestamptz'})
    createdAt: Date;

    @UpdateDateColumn({type: 'timestamptz'})
    updatedAt: Date;
}
