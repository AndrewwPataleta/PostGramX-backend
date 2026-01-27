import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import {ChannelStatus} from '../types/channel-status.enum';

@Entity({name: 'channels'})
@Index('IDX_channels_username', ['username'])
export class ChannelEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({length: 64, unique: true})
    username: string;

    @Column({type: 'bigint', nullable: true, unique: true})
    telegramChatId: string | null;

    @Column({type: 'text'})
    title: string;

    @Column({type: 'enum', enum: ChannelStatus, default: ChannelStatus.DRAFT})
    status: ChannelStatus;

    @Column({type: 'uuid'})
    createdByUserId: string;

    @Column({type: 'timestamptz', nullable: true})
    verifiedAt: Date | null;

    @Column({type: 'timestamptz', nullable: true})
    lastCheckedAt: Date | null;

    @Column({type: 'integer', nullable: true})
    memberCount: number | null;

    @Column({type: 'integer', nullable: true})
    avgViews: number | null;

    @Column({default: false})
    isDisabled: boolean;

    @Column({type: 'jsonb', nullable: true})
    languageStats: Record<string, unknown> | null;

    @Column({nullable: true})
    verificationErrorCode: string | null;

    @Column({type: 'text', nullable: true})
    verificationErrorMessage: string | null;

    @CreateDateColumn({type: 'timestamptz'})
    createdAt: Date;

    @UpdateDateColumn({type: 'timestamptz'})
    updatedAt: Date;
}
