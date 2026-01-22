import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

export enum ChannelVerificationResult {
  SUCCESS = "SUCCESS",
  FAIL = "FAIL"
}

@Entity({ name: "channel_verification_attempts" })
export class ChannelVerificationAttemptEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid", name: "channel_id" })
  channelId!: string;

  @Column({ type: "uuid", name: "user_id" })
  userId!: string;

  @Column({ type: "enum", enum: ChannelVerificationResult })
  result!: ChannelVerificationResult;

  @Column({ type: "varchar", name: "reason_code" })
  reasonCode!: string;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;
}
