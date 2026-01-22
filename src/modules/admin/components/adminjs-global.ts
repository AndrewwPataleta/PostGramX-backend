export interface AdminJSApiClientBase {
  getPage(options: Record<string, unknown>): Promise<unknown>;
  [key: string]: unknown;
}

export type AdminJSGlobalBase<
  ApiClient extends AdminJSApiClientBase = AdminJSApiClientBase,
> = {
  ApiClient?: new () => ApiClient;
  user?: {
    language?: string | null;
    locale?: {
      language?: string | null;
    } | null;
  } | null;
  locale?: {
    language?: string | null;
  } | null;
};

export type AdminJSGlobal = AdminJSGlobalBase<AdminJSApiClientBase>;

declare global {
  interface Window {
    AdminJS?: AdminJSGlobal;
  }
}

export {};
