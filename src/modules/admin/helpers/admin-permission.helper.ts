import { AdminRuleType } from '../entities/admin-rule.entity';
import { ComponentPageName } from '../config/component-groups';
import { AdminSession } from '../types/admin.types';

export const ACCESS_DENIED_ERROR_MESSAGE = 'Access denied';
export const ACCESS_DENIED_ERROR_DESCRIPTION =
  'You do not have permission to perform this action.';

export function hasPagePermission(
  currentAdmin: AdminSession | null | undefined,
  page: ComponentPageName,
  required: AdminRuleType,
): boolean {
  if (!currentAdmin) {
    return false;
  }

  if (currentAdmin.isSuper) {
    return true;
  }

  const permissions = currentAdmin.permissions ?? [];
  return permissions.some((permission) => {
    if (permission.pageKey !== page) {
      return false;
    }

    if (permission.type === 'edit') {
      return true;
    }

    return permission.type === required;
  });
}

export function assertPagePermission(
  currentAdmin: AdminSession | null | undefined,
  page: ComponentPageName,
  required: AdminRuleType,
): void {
  if (hasPagePermission(currentAdmin, page, required)) {
    return;
  }

  const error = new Error(ACCESS_DENIED_ERROR_MESSAGE);
  (error as any).status = 403;
  throw error;
}
