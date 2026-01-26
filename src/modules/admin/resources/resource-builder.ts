import { DataSource } from 'typeorm';


import { ResourceOptions } from '../types/admin.types';
import { createResourceOptionsByName } from './resource-options.factory';
function getTargetName(target: unknown): string {
  if (typeof target === 'function') {
    return (target as { name?: string }).name ?? 'Function';
  }
  if (target && typeof target === 'object') {
    const ctor = (target as any).constructor;
    if (typeof ctor?.name === 'string') return ctor.name;
  }
  return String(target);
}

export function buildResourcesFromDataSource(
  dataSource: DataSource,
  allowedResourceNames?: Set<string>,
) {
  const resources: Array<{ resource: unknown; options?: ResourceOptions }> = [];
  const seenTargets = new Set<unknown>();

  const defaultIdVisibility: NonNullable<ResourceOptions['properties']> = {
    id: {
      isVisible: {
        list: false,
        show: false,
        edit: false,
        filter: true,
      },
    },
  };

  const resourceOptionsByName = createResourceOptionsByName();

  const hiddenFromNavigationNames = new Set<string>([

  ]);

  const defaultNavigationGroup = { name: 'PostgramX', icon: 'Box' };

  for (const metadata of dataSource.entityMetadatas) {
    const target = metadata.target;
    if (!target || typeof target === 'string' || seenTargets.has(target))
      continue;

    seenTargets.add(target);

    const targetName = getTargetName(target);
    if (allowedResourceNames && !allowedResourceNames.has(targetName)) {
      continue;
    }
    const specific = resourceOptionsByName.get(targetName);

    const columnPropertyNames = new Set(
      metadata.columns.map((column) => column.propertyPath),
    );
    const relationPropertyNames = new Map<string, string>();

    for (const relation of metadata.relations) {
      for (const joinColumn of relation.joinColumns ?? []) {
        const joinPropertyName = joinColumn?.propertyName;
        if (joinPropertyName) {
          relationPropertyNames.set(relation.propertyName, joinPropertyName);
          break;
        }
      }
    }

    const resolvePropertyName = (propertyName?: string): string | null => {
      if (!propertyName) return null;
      if (columnPropertyNames.has(propertyName)) {
        return propertyName;
      }

      const relationJoinColumn = relationPropertyNames.get(propertyName);
      if (relationJoinColumn) {
        if (columnPropertyNames.has(relationJoinColumn)) {
          return relationJoinColumn;
        }

        if (columnPropertyNames.has(propertyName)) {
          return propertyName;
        }
      }

      const fallbackName = `${propertyName}Id`;
      if (columnPropertyNames.has(fallbackName)) {
        return fallbackName;
      }

      return null;
    };

    const normalizeProperties = (
      propertyNames: string[] | undefined,
      where: 'list' | 'show' | 'edit' | 'filter',
    ): string[] | undefined => {
      if (!propertyNames || propertyNames.length === 0) {
        return undefined;
      }

      const normalized: string[] = [];

      for (const propertyName of propertyNames) {
        const resolved = resolvePropertyName(propertyName);
        if (resolved) {
          if (!normalized.includes(resolved)) {
            normalized.push(resolved);
          }
          continue;
        }
      }

      return normalized.length > 0 ? normalized : undefined;
    };

    const options: ResourceOptions = {
      navigation: defaultNavigationGroup,
      properties: {
        ...defaultIdVisibility,
        ...(specific?.properties ?? {}),
      },
    };

    if (specific?.listProperties !== undefined) {
      const normalizedListProperties = normalizeProperties(
        specific.listProperties,
        'list',
      );

      if (normalizedListProperties) {
        options.listProperties = normalizedListProperties;
      }
    }

    if (specific?.showProperties !== undefined) {
      const normalizedShowProperties = normalizeProperties(
        specific.showProperties,
        'show',
      );

      if (normalizedShowProperties) {
        options.showProperties = normalizedShowProperties;
      }
    }

    if (specific?.editProperties !== undefined) {
      const normalizedEditProperties = normalizeProperties(
        specific.editProperties,
        'edit',
      );

      if (normalizedEditProperties) {
        options.editProperties = normalizedEditProperties;
      }
    }

    if (specific?.filterProperties !== undefined) {
      const normalizedFilterProperties = normalizeProperties(
        specific.filterProperties,
        'filter',
      );

      if (normalizedFilterProperties) {
        options.filterProperties = normalizedFilterProperties;
      }
    }

    if (specific?.actions !== undefined) {
      options.actions = specific.actions;
    }

    if (hiddenFromNavigationNames.has(targetName)) {
      options.navigation = false;
    }

    resources.push({
      resource: target,
      options,
    });
  }

  return resources;
}

