import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  COMPONENT_PAGE_META,
  ComponentPageName,
} from '../config/component-groups';
import { AdminPage } from '../entities/admin-page.entity';

@Injectable()
export class AdminPageRegistryService implements OnModuleInit {
  constructor(
    @InjectRepository(AdminPage)
    private readonly adminPageRepository: Repository<AdminPage>,
  ) {}

  async onModuleInit(): Promise<void> {
    const entries = Object.entries(COMPONENT_PAGE_META);

    for (const [key, meta] of entries) {
      await this.upsertPage(key as ComponentPageName, meta.label, meta.description);
    }
  }

  private async upsertPage(
    key: ComponentPageName,
    label: string,
    description?: string,
  ): Promise<void> {
    const existing = await this.adminPageRepository.findOne({
      where: { key },
    });

    if (!existing) {
      const created = this.adminPageRepository.create({
        key,
        name: label,
        description: description ?? null,
      });
      await this.adminPageRepository.save(created);
      return;
    }

    let shouldUpdate = false;

    if (existing.name !== label) {
      existing.name = label;
      shouldUpdate = true;
    }

    const normalizedDescription = description ?? null;
    if (existing.description !== normalizedDescription) {
      existing.description = normalizedDescription;
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      await this.adminPageRepository.save(existing);
    }
  }
}
