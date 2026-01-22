import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";
import { ChannelStatus } from "../enums/channel-status";

@Entity({ name: "channels" })
export class ChannelEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index()
  @Column({ type: "varchar", nullable: true })
  username!: string | null;

  @Index({ unique: true, where: "telegram_chat_id IS NOT NULL" })
  @Column({ type: "bigint", nullable: true, name: "telegram_chat_id" })
  telegramChatId!: string | null;

  @Column({ type: "varchar" })
  title!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ type: "varchar", nullable: true, name: "photo_file_id" })
  photoFileId!: string | null;

  @Column({ type: "enum", enum: ChannelStatus, default: ChannelStatus.PENDING })
  status!: ChannelStatus;

  @Column({ type: "timestamptz", nullable: true, name: "bot_admin_verified_at" })
  botAdminVerifiedAt!: Date | null;

  @Column({ type: "timestamptz", nullable: true, name: "last_admin_recheck_at" })
  lastAdminRecheckAt!: Date | null;

  @Column({ type: "int", nullable: true, name: "member_count" })
  memberCount!: number | null;

  @Column({ type: "timestamptz", nullable: true, name: "last_stats_sync_at" })
  lastStatsSyncAt!: Date | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
