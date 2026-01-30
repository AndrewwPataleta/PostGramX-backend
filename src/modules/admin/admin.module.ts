import { DynamicModule, Module } from '@nestjs/common';

import {
  adminAuthOptions,
  adminJsOptions,
  adminSessionOptions,
} from './adminjs.config';

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
    useFactory: async () => ({
      adminJsOptions,
      auth: adminAuthOptions,
      sessionOptions: adminSessionOptions,
    }),
  });
});

@Module({
  imports: [adminJsModulePromise],
})
export class AdminModule {}
