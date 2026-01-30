import { Request } from 'express';

import {
  PostgramX_ADMIN_LOGIN_STYLES_DATA_URI,
  PostgramX_ADMIN_LOGO_DATA_URI,
} from './admin-branding';
import { PostgramX_ADMIN_DESIGN_SYSTEM_STYLES_DATA_URI } from './admin-design-system';
import { adminLocaleTranslations } from './config/admin-translations';
import {
  ADMIN_LOGIN_PATH,
  ADMIN_LOGOUT_PATH,
  ADMIN_ROOT_PATH,
} from './config/paths';
import { adminResources } from './resources';
import { AdminSession } from './types/admin.types';
import { normalizeAdminLanguage } from './utils/admin-language';

const DEFAULT_ADMIN_LANGUAGE = normalizeAdminLanguage(
  process.env.ADMIN_DEFAULT_LANGUAGE,
);

const resolveAdminLocaleLanguage = (
  currentAdmin?: Partial<AdminSession> | null,
) =>
  normalizeAdminLanguage(
    currentAdmin?.language ??
      currentAdmin?.locale?.language ??
      DEFAULT_ADMIN_LANGUAGE,
  );

const parseAdminTelegramAllowlist = (): Set<string> => {
  const raw = process.env.ADMIN_TELEGRAM_IDS ?? '';
  const values = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return new Set(values);
};

export const isAdminRequestAllowed = (req: Request): boolean => {
  const user = req.user;
  if (!user) {
    return false;
  }

  if ((user as any).isAdmin === true) {
    return true;
  }

  const allowlist = parseAdminTelegramAllowlist();
  if (allowlist.size === 0) {
    return false;
  }

  const telegramId = user.telegramId ?? '';
  return allowlist.has(String(telegramId));
};

export const adminJsOptions = {
  rootPath: ADMIN_ROOT_PATH,
  loginPath: ADMIN_LOGIN_PATH,
  logoutPath: ADMIN_LOGOUT_PATH,
  resources: adminResources,
  branding: {
    companyName: 'PostgramX Admin',
    logo: PostgramX_ADMIN_LOGO_DATA_URI,
    softwareBrothers: false,
    withMadeWithLove: false,
  },
  locale: (currentAdmin: Partial<AdminSession> | null) => ({
    language: resolveAdminLocaleLanguage(currentAdmin),
    translations: adminLocaleTranslations,
  }),
  assets: {
    styles: [
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto:wght@300;400;500;700&display=swap',
      PostgramX_ADMIN_LOGIN_STYLES_DATA_URI,
      PostgramX_ADMIN_DESIGN_SYSTEM_STYLES_DATA_URI,
    ],
  },
  settings: {
    defaultPerPage: 20,
  },
};

export const adminAuthOptions = {
  authenticate: async (login: string, password: string) => {
    const rawLogin = typeof login === 'string' ? login.trim() : '';
    const normalizedLogin = rawLogin.toLowerCase();
    const superLogin = process.env.ADMIN_EMAIL
      ? process.env.ADMIN_EMAIL.trim().toLowerCase()
      : null;
    const superPassword = process.env.ADMIN_PASSWORD ?? null;

    if (
      superLogin &&
      superPassword &&
      normalizedLogin === superLogin &&
      password === superPassword
    ) {
      return buildSuperAdminSession(rawLogin || 'super-admin');
    }

    return null;
  },
  cookieName: 'adminjs',
  cookiePassword: process.env.ADMIN_COOKIE_SECRET ?? 'secret',
};

export const adminSessionOptions = {
  secret: process.env.ADMIN_COOKIE_SECRET ?? 'secret',
  resave: false,
  saveUninitialized: false,
};

function buildSuperAdminSession(login: string): AdminSession {
  const language = normalizeAdminLanguage(process.env.ADMIN_DEFAULT_LANGUAGE);
  return {
    id: 'env-super-admin',
    login,
    email: login,
    name: 'Super Admin',
    isSuper: true,
    language,
    locale: { language },
    permissions: [],
  };
}
