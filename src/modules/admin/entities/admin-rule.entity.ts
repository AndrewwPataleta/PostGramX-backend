import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { AdminPage } from './admin-page.entity';
import { AdminUser } from './admin-user.entity';

export type AdminRuleType = 'view' | 'edit';

@Entity({ name: 'admin_rule' })
export class AdminRule extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({
    type: 'enum',
    enum: ['view', 'edit'],
    enumName: 'admin_rule_type_enum',
    default: 'view',
  })
  type: AdminRuleType;

  @ManyToOne(() => AdminPage, (page) => page.rules, {
    onDelete: 'CASCADE',
    eager: true,
  })
  @JoinColumn({ name: 'page_id' })
  page: AdminPage;

  @Column({ name: 'page_id', type: 'uuid' })
  pageId: string;

  @ManyToMany(() => AdminUser, (user) => user.rules)
  users?: AdminUser[];

  @ManyToOne(() => AdminUser, (user) => user.createdRules, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'created_by_id' })
  createdBy?: AdminUser | null;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
