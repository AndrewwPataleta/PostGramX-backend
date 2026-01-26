import { DataSource, Repository } from 'typeorm';

import {
  COMPONENT_GROUPS,
  COMPONENT_PAGE_META,
  type ComponentGroupId,
  type ComponentPageName,
} from '../config/component-groups';
import { AdminPage } from '../entities/admin-page.entity';
import { AdminRule, AdminRuleType } from '../entities/admin-rule.entity';
import { AdminUser } from '../entities/admin-user.entity';
import { hashAdminPassword } from '../helpers/admin-password.helper';
import {
  SupportedLanguage,
} from '../../../common/i18n/supported-languages';
import {
  ADMIN_LANGUAGES,
  normalizeAdminLanguage,
} from '../utils/admin-language';

const RULE_LABEL: Record<AdminRuleType, string> = {
  view: 'View',
  edit: 'Edit',
};

const ADMIN_ACCESS_PAGE_KEY: ComponentPageName = 'adminAccess';

const ASSIGNABLE_PAGE_KEYS = (
  Object.keys(COMPONENT_PAGE_META) as ComponentPageName[]
).filter((key) => key !== ADMIN_ACCESS_PAGE_KEY);

const ASSIGNABLE_PAGE_KEY_SET = new Set<ComponentPageName>(
  ASSIGNABLE_PAGE_KEYS,
);

type AdminAccessPageSummary = {
  key: ComponentPageName;
  label: string;
  description: string | null;
  groupId: ComponentGroupId;
};

type AdminAccessRuleSummary = {
  id: string;
  pageKey: ComponentPageName;
  type: AdminRuleType;
};

type AdminAccessUserSummary = {
  id: string;
  name: string;
  login: string;
  isSuper: boolean;
  createdAt: string;
  rules: AdminAccessRuleSummary[];
  language: SupportedLanguage;
};

type AdminAccessTotals = {
  totalAdmins: number;
  superAdmins: number;
  managedPages: number;
  permissionLinks: number;
};

type AdminAccessMetadataResponse = {
  success: true;
  type: 'metadata';
  generatedAt: string;
  pages: AdminAccessPageSummary[];
  users: AdminAccessUserSummary[];
  totals: AdminAccessTotals;
  languages: SupportedLanguage[];
};

type AdminAccessMutationResponse = {
  success: true;
  type: 'mutation';
  user: AdminAccessUserSummary;
  message: string;
};

type AdminAccessErrorResponse = {
  success: false;
  message: string;
  details?: string[];
};

type AdminAccessResponse =
  | AdminAccessMetadataResponse
  | AdminAccessMutationResponse
  | AdminAccessErrorResponse;

type AdminAccessPermissionInput = {
  pageKey?: string;
  view?: unknown;
  edit?: unknown;
};

type AdminAccessPayload = {
  action?: 'create' | 'update';
  userId?: string;
  name?: string;
  login?: string;
  password?: string;
  isSuper?: unknown;
  permissions?: AdminAccessPermissionInput[];
  language?: string;
};

type RuleMapEntry = {
  view: AdminRule;
  edit: AdminRule;
};

type RuleMap = Map<ComponentPageName, RuleMapEntry>;

export async function handleAdminAccessRequest(
  request: any,
  dataSource: DataSource,
  context?: any,
): Promise<AdminAccessResponse> {
  const currentAdmin = context?.currentAdmin;
  if (!currentAdmin?.isSuper) {
    return {
      success: false,
      message:
        'Admin access management is restricted to super users.',
    };
  }

  const method =
    typeof request?.method === 'string' ? request.method.toLowerCase() : 'get';

  if (method !== 'get' && method !== 'post') {
    return {
      success: false,
      message: 'Method not supported for adminAccess.',
    };
  }

  const userRepository = dataSource.getRepository(AdminUser);
  const pageRepository = dataSource.getRepository(AdminPage);
  const ruleRepository = dataSource.getRepository(AdminRule);

  const assignablePages = buildAssignablePages();
  const ruleMap = await ensureRuleMap(pageRepository, ruleRepository);

  if (method === 'get') {
    const users = await userRepository.find({
      relations: ['rules', 'rules.page'],
      order: { createdAt: 'ASC' },
    });
    const serializedUsers = users.map(serializeAdminUser);
    return {
      success: true,
      type: 'metadata',
      generatedAt: new Date().toISOString(),
      pages: assignablePages,
      users: serializedUsers,
      totals: buildTotals(serializedUsers, assignablePages.length),
      languages: [...ADMIN_LANGUAGES],
    };
  }

  const payload = (request?.payload ?? {}) as AdminAccessPayload;
  const action = payload.action;

  if (action !== 'create' && action !== 'update') {
    return {
      success: false,
      message: 'Unknown action for adminAccess.',
    };
  }

  const normalizedName = normalizeName(payload.name);
  const normalizedLogin = normalizeLogin(payload.login);
  const normalizedPassword = (payload.password ?? '').trim();
  const isSuper = normalizeBoolean(payload.isSuper);
  const normalizedLanguage = normalizeAdminLanguage(payload.language);

  const permissionInput = Array.isArray(payload.permissions)
    ? payload.permissions
    : [];
  const normalizedPermissions = normalizePermissionInput(permissionInput);

  const rulesToAssign = isSuper
    ? Array.from(ruleMap.values()).flatMap((entry) => [entry.view, entry.edit])
    : resolveRulesFromPermissions(normalizedPermissions, ruleMap);

  const ruleIds = new Set(rulesToAssign.map((rule) => rule.id));
  const dedupedRules = Array.from(ruleIds).map(
    (id) => rulesToAssign.find((rule) => rule.id === id)!,
  );

  if (action === 'create') {
    const errors: string[] = [];
    if (!normalizedName) {
      errors.push('Provide the admin name.');
    }
    if (!normalizedLogin) {
      errors.push('Provide login / email.');
    }
    if (!normalizedPassword) {
      errors.push('Provide a password for the new admin.');
    } else if (normalizedPassword.length < 8) {
      errors.push('Password must be at least 8 characters.');
    }

    if (errors.length) {
      return { success: false, message: errors[0], details: errors };
    }

    const existingUser = await userRepository.findOne({
      where: { loginLowercase: normalizedLogin!.toLowerCase() },
    });

    if (existingUser) {
      return {
        success: false,
        message: 'An admin with this login already exists.',
      };
    }

    const { hash, salt } = await hashAdminPassword(normalizedPassword!);

    const createdById = getContextAdminDatabaseId(currentAdmin?.id);

    const user = userRepository.create({
      name: normalizedName ?? normalizedLogin!,
      login: normalizedLogin!,
      loginLowercase: normalizedLogin!.toLowerCase(),
      passwordHash: hash,
      passwordSalt: salt,
      isSuper,
      language: normalizedLanguage,
      createdById,
      rules: dedupedRules,
    });

    const saved = await userRepository.save(user);
    const freshUser = await userRepository.findOne({
      where: { id: saved.id },
      relations: ['rules', 'rules.page'],
    });

    return {
      success: true,
      type: 'mutation',
      user: serializeAdminUser(freshUser ?? saved),
      message: 'Admin created successfully.',
    };
  }

  const targetId = payload.userId;
  if (!targetId) {
    return {
      success: false,
      message: 'Admin identifier is missing.',
    };
  }

  const target = await userRepository.findOne({
    where: { id: targetId },
    relations: ['rules', 'rules.page'],
  });

  if (!target) {
    return {
      success: false,
      message: 'Admin not found.',
    };
  }

  if (normalizedName) {
    target.name = normalizedName;
  }

  if (
    normalizedLogin &&
    normalizedLogin.toLowerCase() !== target.loginLowercase
  ) {
    const duplicate = await userRepository.findOne({
      where: { loginLowercase: normalizedLogin.toLowerCase() },
    });
    if (duplicate && duplicate.id !== target.id) {
      return {
        success: false,
        message: 'The specified login is already used by another admin.',
      };
    }
    target.login = normalizedLogin;
    target.loginLowercase = normalizedLogin.toLowerCase();
  }

  if (normalizedPassword) {
    if (normalizedPassword.length < 8) {
      return {
        success: false,
        message: 'Password must be at least 8 characters.',
      };
    }
    const { hash, salt } = await hashAdminPassword(normalizedPassword);
    target.passwordHash = hash;
    target.passwordSalt = salt;
  }

  target.isSuper = isSuper;
  target.language = normalizedLanguage;
  target.rules = dedupedRules;

  await userRepository.save(target);

  const updated = await userRepository.findOne({
    where: { id: target.id },
    relations: ['rules', 'rules.page'],
  });

  return {
    success: true,
    type: 'mutation',
    user: serializeAdminUser(updated ?? target),
    message: 'Admin settings updated.',
  };
}

function buildAssignablePages(): AdminAccessPageSummary[] {
  const pages: AdminAccessPageSummary[] = [];
  for (const group of COMPONENT_GROUPS) {
    for (const page of group.pages) {
      if (page.name === ADMIN_ACCESS_PAGE_KEY) {
        continue;
      }
      pages.push({
        key: page.name,
        label: page.label,
        description: page.description ?? null,
        groupId: group.id,
      });
    }
  }
  return pages;
}

async function ensureRuleMap(
  pageRepository: Repository<AdminPage>,
  ruleRepository: Repository<AdminRule>,
): Promise<RuleMap> {
  const pages = await pageRepository.find();
  const rules = await ruleRepository.find();
  const pageById = new Map<string, AdminPage>();
  const map: RuleMap = new Map();
  pages.forEach((page) => pageById.set(page.id, page));

  const existingRules = new Map<string, AdminRule>();
  for (const rule of rules) {
    const page = pageById.get(rule.pageId);
    if (!page) {
      continue;
    }
    rule.page = page;
    existingRules.set(
      buildRuleKey(page.key as ComponentPageName, rule.type),
      rule,
    );
  }

  for (const page of pages) {
    const pageKey = page.key as ComponentPageName;
    const viewRule = await ensureRule(
      page,
      'view',
      existingRules.get(buildRuleKey(page.key as ComponentPageName, 'view')),
      ruleRepository,
    );
    const editRule = await ensureRule(
      page,
      'edit',
      existingRules.get(buildRuleKey(page.key as ComponentPageName, 'edit')),
      ruleRepository,
    );
    map.set(pageKey, { view: viewRule, edit: editRule });
  }

  return map;
}

async function ensureRule(
  page: AdminPage,
  type: AdminRuleType,
  rule: AdminRule | undefined,
  ruleRepository: Repository<AdminRule>,
): Promise<AdminRule> {
  const desiredName = `${RULE_LABEL[type]} — ${page.name}`;
  if (!rule) {
    const created = ruleRepository.create({
      name: desiredName,
      type,
      pageId: page.id,
    });
    const saved = await ruleRepository.save(created);
    saved.page = page;
    return saved;
  }

  if (rule.name !== desiredName) {
    rule.name = desiredName;
    await ruleRepository.save(rule);
  }

  rule.page = page;
  return rule;
}

function buildRuleKey(pageKey: ComponentPageName, type: AdminRuleType): string {
  return `${pageKey}:${type}`;
}

function buildTotals(
  users: AdminAccessUserSummary[],
  managedPages: number,
): AdminAccessTotals {
  return {
    totalAdmins: users.length,
    superAdmins: users.filter((user) => user.isSuper).length,
    managedPages,
    permissionLinks: users.reduce(
      (acc, user) => acc + (user.rules?.length ?? 0),
      0,
    ),
  };
}

function serializeAdminUser(user?: AdminUser | null): AdminAccessUserSummary {
  const rules = (user?.rules ?? []).filter((rule): rule is AdminRule =>
    Boolean(rule?.page?.key && rule.type),
  );
  return {
    id: user?.id ?? 'unknown',
    name: user?.name ?? 'No name',
    login: user?.login ?? '—',
    isSuper: Boolean(user?.isSuper),
    createdAt: user?.createdAt?.toISOString?.() ?? new Date().toISOString(),
    language: normalizeAdminLanguage(user?.language),
    rules: rules.map((rule) => ({
      id: rule.id,
      pageKey: rule.page!.key as ComponentPageName,
      type: rule.type,
    })),
  };
}

function normalizeName(value?: string | null): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeLogin(value?: string | null): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1';
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  return Boolean(value);
}

function normalizePermissionInput(permissions: AdminAccessPermissionInput[]): {
  pageKey: ComponentPageName;
  view: boolean;
  edit: boolean;
}[] {
  const normalized: {
    pageKey: ComponentPageName;
    view: boolean;
    edit: boolean;
  }[] = [];

  for (const entry of permissions) {
    const rawKey = entry?.pageKey;
    if (typeof rawKey !== 'string') {
      continue;
    }
    if (!ASSIGNABLE_PAGE_KEY_SET.has(rawKey as ComponentPageName)) {
      continue;
    }
    const pageKey = rawKey as ComponentPageName;
    const view = normalizeBoolean(entry.view);
    const edit = normalizeBoolean(entry.edit);
    normalized.push({
      pageKey,
      view,
      edit,
    });
  }

  return normalized;
}

function resolveRulesFromPermissions(
  permissions: {
    pageKey: ComponentPageName;
    view: boolean;
    edit: boolean;
  }[],
  ruleMap: RuleMap,
): AdminRule[] {
  const result: AdminRule[] = [];

  for (const permission of permissions) {
    const mapEntry = ruleMap.get(permission.pageKey);
    if (!mapEntry) {
      continue;
    }
    if (permission.view) {
      result.push(mapEntry.view);
    }
    if (permission.edit) {
      result.push(mapEntry.edit);
      if (!permission.view) {
        result.push(mapEntry.view);
      }
    }
  }

  return result;
}

function getContextAdminDatabaseId(id?: string | null): string | null {
  if (typeof id !== 'string') {
    return null;
  }
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(id) ? id : null;
}
