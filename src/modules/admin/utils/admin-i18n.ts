import { normalizeLanguage } from '../../../common/i18n/supported-languages';

export const adminUiTranslations = {
  en: {
    nouns: {
      product: 'Product',
      products: 'Products',
      productRegion: 'Product region',
      productCategories: 'Product categories',
      productTags: 'Product tags',
      productDescription: 'Product description',
    },
    actions: {
      addProduct: 'Add product',
      addToProduct: 'Add to product',
    },
    headings: {
      addToProduct: 'Adding to product',
      productTransfer: 'Product transfer',
      productCategories: 'Product categories',
      productModeration: 'Product moderation',
    },
    messages: {
      productCreationFailed: 'Failed to create product.',
      productSelectionHint:
        'Specify category and region to fetch product cards and quickly add them to products.',
      productImportHint:
        'If you used quick import, launch the step-by-step import to create partner links and product cards. If no format fits, use the JSON import.',
      productExportFile: 'Select a file generated from product export.',
    },
    adminAccess: {
      title: 'Admin access management',
      description:
        'Create administrators, assign view/edit rights for pages, and keep access in sync.',
      stats: {
        totalAdmins: 'Total admins',
        superAdmins: 'Super admins',
        managedPages: 'Managed pages',
        permissionLinks: 'Assigned rules',
      },
      actions: {
        newAdmin: '+ New admin',
        refresh: 'Refresh data',
        clearForm: 'Clear form',
        save: 'Save changes',
        saving: 'Saving...',
      },
      sections: {
        admins: 'Administrators',
        newAdmin: 'New administrator',
        editAdmin: 'Edit',
        permissions: 'Access permissions',
      },
      meta: {
        syncedAt: 'Synced at',
        createdAt: 'Created',
        view: 'View',
        edit: 'Edit',
        language: 'Language',
      },
      form: {
        name: 'Name',
        login: 'Login / Email',
        language: 'Interface language',
        password: 'Password',
        passwordOptional: 'Password (optional)',
        confirmPassword: 'Confirm password',
        superAdmin:
          'Super admin — gets access to all pages and permissions',
      },
      placeholders: {
        name: 'For example, Support Team',
        login: 'admin@example.com',
        passwordNew: 'At least 8 characters',
        passwordEdit: 'Leave empty to keep unchanged',
        confirmPassword: 'Repeat password',
      },
      helper: {
        login: 'Used to sign in to the admin panel (unique value).',
        language: 'Defines the administrator interface language.',
      },
      states: {
        loading: 'Loading...',
        emptyAdmins:
          'No administrators created yet. Add a new one to grant page access.',
        noPages: 'No pages available for assigning permissions.',
      },
      errors: {
        apiClientUnavailable: 'AdminJS ApiClient is not available in the browser.',
        fetchFailed: 'Unable to load access data.',
        saveFailed: 'Unable to save changes.',
        requiredFields: 'Please fill in required fields.',
        passwordMismatch: 'Passwords do not match.',
        passwordTooShort: 'Password must be at least 8 characters.',
      },
      table: {
        page: 'Page',
        view: 'View',
        edit: 'Edit',
      },
      badges: {
        super: 'Super',
        standard: 'Standard',
      },
    },
  },
  ru: {
    nouns: {
      product: 'Product',
      products: 'Products',
      productRegion: 'Product region',
      productCategories: 'Product categories',
      productTags: 'Product tags',
      productDescription: 'Product description',
    },
    actions: {
      addProduct: 'Add product',
      addToProduct: 'Add to product',
    },
    headings: {
      addToProduct: 'Adding to product',
      productTransfer: 'Product transfer',
      productCategories: 'Product categories',
      productModeration: 'Product moderation',
    },
    messages: {
      productCreationFailed: 'Failed to create product.',
      productSelectionHint:
        'Specify category and region to fetch product cards and quickly add them to products.',
      productImportHint:
        'If you used quick import, launch the step-by-step import to create partner links and product cards. If no format fits, use the JSON import.',
      productExportFile: 'Select a file generated from product export.',
    },
    adminAccess: {
      title: 'Admin access management',
      description:
        'Create administrators, assign view/edit rights for pages, and keep access in sync.',
      stats: {
        totalAdmins: 'Total admins',
        superAdmins: 'Super admins',
        managedPages: 'Managed pages',
        permissionLinks: 'Assigned rules',
      },
      actions: {
        newAdmin: '+ New admin',
        refresh: 'Refresh data',
        clearForm: 'Clear form',
        save: 'Save changes',
        saving: 'Saving...',
      },
      sections: {
        admins: 'Administrators',
        newAdmin: 'New administrator',
        editAdmin: 'Edit',
        permissions: 'Access permissions',
      },
      meta: {
        syncedAt: 'Synced at',
        createdAt: 'Created',
        view: 'View',
        edit: 'Edit',
        language: 'Language',
      },
      form: {
        name: 'Name',
        login: 'Login / Email',
        language: 'Interface language',
        password: 'Password',
        passwordOptional: 'Password (optional)',
        confirmPassword: 'Confirm password',
        superAdmin:
          'Super admin — gets access to all pages and permissions',
      },
      placeholders: {
        name: 'For example, Support Team',
        login: 'admin@example.com',
        passwordNew: 'At least 8 characters',
        passwordEdit: 'Leave empty to keep unchanged',
        confirmPassword: 'Repeat password',
      },
      helper: {
        login: 'Used to sign in to the admin panel (unique value).',
        language: 'Defines the administrator interface language.',
      },
      states: {
        loading: 'Loading...',
        emptyAdmins:
          'No administrators created yet. Add a new one to grant page access.',
        noPages: 'No pages available for assigning permissions.',
      },
      errors: {
        apiClientUnavailable: 'AdminJS ApiClient is not available in the browser.',
        fetchFailed: 'Unable to load access data.',
        saveFailed: 'Unable to save changes.',
        requiredFields: 'Please fill in required fields.',
        passwordMismatch: 'Passwords do not match.',
        passwordTooShort: 'Password must be at least 8 characters.',
      },
      table: {
        page: 'Page',
        view: 'View',
        edit: 'Edit',
      },
      badges: {
        super: 'Super',
        standard: 'Standard',
      },
    },
  },
} as const;

export type AdminUiLocale = keyof typeof adminUiTranslations;

const AVAILABLE_LOCALES = Object.keys(adminUiTranslations) as AdminUiLocale[];

const DEFAULT_LOCALE: AdminUiLocale = 'en';

const normalizeLocale = (language?: string | null): AdminUiLocale => {
  const normalized = normalizeLanguage(language) as AdminUiLocale;
  return AVAILABLE_LOCALES.includes(normalized) ? normalized : DEFAULT_LOCALE;
};

const resolveLocale = (): AdminUiLocale => {
  if (typeof window !== 'undefined') {
    const adminGlobal = (window as any)?.AdminJS as
      | { user?: { language?: string; locale?: { language?: string } }; locale?: { language?: string } }
      | undefined;

    const preferredLanguage =
      adminGlobal?.user?.language ||
      adminGlobal?.user?.locale?.language ||
      adminGlobal?.locale?.language ||
      (typeof navigator !== 'undefined' ? navigator.language : null);

    return normalizeLocale(preferredLanguage);
  }

  return DEFAULT_LOCALE;
};

export const adminTranslate = (
  path: string,
  locale: AdminUiLocale = resolveLocale(),
): string => {
  const segments = path.split('.');
  const getValue = (lang: AdminUiLocale) =>
    segments.reduce<unknown>((acc, key) => (acc as any)?.[key], adminUiTranslations[lang]);

  const value = getValue(locale);
  if (typeof value === 'string') {
    return value;
  }

  const fallbackValue = getValue(DEFAULT_LOCALE);
  if (typeof fallbackValue === 'string') {
    return fallbackValue;
  }

  return path;
};
