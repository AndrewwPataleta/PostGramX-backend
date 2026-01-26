import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import {ChannelRole} from '../types/channel-role.enum';

export enum TelegramAdminStatus {
    CREATOR = 'creator',
    ADMINISTRATOR = 'administrator',
}

@Entity({name: 'channel_memberships'})
@Index('IDX_channel_memberships_channel_id', ['channelId'])
@Index('IDX_channel_memberships_user_id', ['userId'])
@Index('IDX_channel_memberships_channel_user', ['channelId', 'userId'], {
    unique: true,
})
export class ChannelMembershipEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({type: 'uuid'})
    channelId: string;

    @Column({type: 'uuid'})
    userId: string;

    @Column({type: 'enum', enum: ChannelRole})
    role: ChannelRole;

    @Column({
        type: 'enum',
        enum: TelegramAdminStatus,
        nullable: true,
    })
    telegramAdminStatus: TelegramAdminStatus | null;

    @Column({type: 'jsonb', nullable: true})
    permissionsSnapshot: Record<string, unknown> | null;

    @Column({default: true})
    isActive: boolean;

    @Column({type: 'timestamptz', nullable: true})
    lastRecheckAt: Date | null;

    @CreateDateColumn({type: 'timestamptz'})
    createdAt: Date;

    @UpdateDateColumn({type: 'timestamptz'})
    updatedAt: Date;
}
