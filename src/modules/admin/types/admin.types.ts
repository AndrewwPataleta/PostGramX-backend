import { ComponentPageName } from '../config/component-groups';
import { AdminRuleType } from '../entities/admin-rule.entity';
import { SupportedLanguage } from '../../../common/i18n/supported-languages';

export type AdminPropertyComponentMap = Partial<
  Record<'show' | 'list' | 'edit' | 'filter', string>
>;

export type AdminPagePermission = {
  pageKey: ComponentPageName;
  type: AdminRuleType;
};

export type AdminSession = {
  id: string;
  login: string;
  email: string;
  name?: string;
  isSuper?: boolean;
  permissions: AdminPagePermission[];
  language?: SupportedLanguage;
  locale?: { language: SupportedLanguage };
};

export type AdminComponentLoader = {
  add: (name: string, componentPath: string) => string;
  override: (name: string, componentPath: string) => string;
};

export type AdminComponentLoaderConstructor = new () => unknown;

export type AdminActionBeforeHook = (
  request: any,
  context?: any,
) => any | Promise<any>;

export type AdminActionAfterHook = (
  response: any,
  context?: any,
) => any | Promise<any>;

export type AdminActionHandler = (
  request: any,
  response: any,
  context: any,
) => any | Promise<any>;

export type AdminActionOptions = {
  actionType?: 'record' | 'resource' | 'bulk';
  icon?: string;
  component?: string;
  showInDrawer?: boolean;
  guard?: string;
  handler?: AdminActionHandler;
  before?: AdminActionBeforeHook;
  after?: AdminActionAfterHook;
  [key: string]: unknown;
};

export type AdminPropertyOptions = {
  isVisible?:
    | boolean
    | {
        list?: boolean;
        show?: boolean;
        edit?: boolean;
        filter?: boolean;
      };
  isDisabled?: boolean;
  isSortable?: boolean;
  components?: AdminPropertyComponentMap;
  label?: string;
  [key: string]: unknown;
};

export type ResourceOptions = {
  listProperties?: string[];
  showProperties?: string[];
  editProperties?: string[];
  filterProperties?: string[];
  properties?: Record<string, AdminPropertyOptions>;
  actions?: Record<string, AdminActionOptions>;
  navigation?: string | { name: string; icon?: string } | null | false;
  [key: string]: unknown;
};

export type UserMessageChannel = 'telegram';

export type UserMessageChannelState = {
  available: boolean;
  reason?: string | null;
};

export type UserMessageChannelInfo = Record<
  UserMessageChannel,
  UserMessageChannelState
>;

export type UserMessageChannelResult = {
  channel: UserMessageChannel;
  sent: boolean;
  error?: string;
};

export type AdminComponentRegistry = {
  userRelatedLinks: string;
  dashboard: string;
};
