import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class TelegramUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  telegramId: string;

  @Column({ nullable: true })
  username?: string | null;

  @Column({ nullable: true })
  firstName?: string | null;

  @Column({ nullable: true })
  lastName?: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
