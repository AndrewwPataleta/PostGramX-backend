import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";
import { ChannelEntity } from "./channel.entity";
import { UserEntity } from "../../auth/entities/user.entity";
import { ChannelManagerRole } from "../enums/channel-manager-role";

@Entity({ name: "channel_managers" })
@Index(["channelId", "userId"], { unique: true })
export class ChannelManagerEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid", name: "channel_id" })
  channelId!: string;

  @Column({ type: "uuid", name: "user_id" })
  userId!: string;

  @ManyToOne(() => ChannelEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "channel_id" })
  channel!: ChannelEntity;

  @ManyToOne(() => UserEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: UserEntity;

  @Column({ type: "enum", enum: ChannelManagerRole })
  role!: ChannelManagerRole;

  @Column({ type: "boolean", default: true, name: "is_active" })
  isActive!: boolean;

  @Column({ type: "jsonb", nullable: true, name: "rights_snapshot" })
  rightsSnapshot!: Record<string, unknown> | null;

  @Column({ type: "timestamptz", nullable: true, name: "last_recheck_at" })
  lastRecheckAt!: Date | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
