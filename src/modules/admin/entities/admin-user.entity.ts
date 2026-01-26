import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { AdminRule } from './admin-rule.entity';
import { SupportedLanguage } from '../../../common/i18n/supported-languages';

@Entity({ name: 'admin_user' })
export class AdminUser extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', unique: true })
  login: string;

  @Column({ name: 'login_lowercase', type: 'text', unique: true })
  loginLowercase: string;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash: string;

  @Column({ name: 'password_salt', type: 'text' })
  passwordSalt: string;

  @Column({ name: 'is_super', default: false })
  isSuper: boolean;

  @Column({ type: 'text', default: 'en' })
  language: SupportedLanguage;

  @ManyToOne(() => AdminUser, (user) => user.createdUsers, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'created_by_id' })
  createdBy?: AdminUser | null;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById?: string | null;

  @ManyToMany(() => AdminRule, (rule) => rule.users, { cascade: true })
  @JoinTable({
    name: 'admin_user_rules',
    joinColumn: { name: 'admin_user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'admin_rule_id', referencedColumnName: 'id' },
  })
  rules?: AdminRule[];

  @OneToMany(() => AdminRule, (rule) => rule.createdBy)
  createdRules?: AdminRule[];

  @OneToMany(() => AdminUser, (user) => user.createdBy)
  createdUsers?: AdminUser[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
