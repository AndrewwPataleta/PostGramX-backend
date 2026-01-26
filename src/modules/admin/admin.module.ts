import { DynamicModule, Module } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { User } from '../auth/entities/user.entity';
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
import { buildResourcesFromDataSource } from './resources/resource-builder';
import { AdminSession } from './types/admin.types';
import { normalizeAdminLanguage } from './utils/admin-language';
import { SupportedLanguage } from '../../common/i18n/supported-languages';

const DEFAULT_ADMIN_LANGUAGE = normalizeAdminLanguage(
  process.env.ADMIN_DEFAULT_LANGUAGE,
);

const resolveAdminLocaleLanguage = (
  currentAdmin?: Partial<AdminSession> | null,
): SupportedLanguage =>
  normalizeAdminLanguage(
    currentAdmin?.language ??
      currentAdmin?.locale?.language ??
      DEFAULT_ADMIN_LANGUAGE,
  );

const adminJsModulePromise: Promise<DynamicModule> = import(
  '@adminjs/nestjs'
).then(async ({ AdminModule: AdminJSModule }) => {
  const adminJsModule = await import('adminjs');
  const AdminJS = adminJsModule.default;
  const AdminJSTypeorm = await import('@adminjs/typeorm');

  AdminJS.registerAdapter({
    Database: AdminJSTypeorm.Database,
    Resource: AdminJSTypeorm.Resource,
  });

  return AdminJSModule.createAdminAsync({
    useFactory: async (dataSource: DataSource) => {
      const resources = buildResourcesFromDataSource(
        dataSource,
        new Set([User.name]),
      );

      return {
        adminJsOptions: {
          rootPath: ADMIN_ROOT_PATH,
          loginPath: ADMIN_LOGIN_PATH,
          logoutPath: ADMIN_LOGOUT_PATH,
          resources,
          branding: {
            companyName: 'PostgramX Admin',
            logo: PostgramX_ADMIN_LOGO_DATA_URI,
            softwareBrothers: false,
            withMadeWithLove: false,
          },
          locale: (currentAdmin) => ({
            language: resolveAdminLocaleLanguage(
              currentAdmin as Partial<AdminSession> | null,
            ),
            translations: adminLocaleTranslations,
          }),
          assets: {
            styles: [
              'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto:wght@300;400;500;700&display=swap',
              PostgramX_ADMIN_LOGIN_STYLES_DATA_URI,
              PostgramX_ADMIN_DESIGN_SYSTEM_STYLES_DATA_URI,
            ],
          },
        },
        auth: {
          authenticate: async (login, password) => {
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
        },
        sessionOptions: {
          secret: process.env.ADMIN_COOKIE_SECRET ?? 'secret',
          resave: false,
          saveUninitialized: false,
        },
      };
    },
    inject: [DataSource],
  });
});

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

@Module({
  imports: [adminJsModulePromise],
})
export class AdminModule {}
