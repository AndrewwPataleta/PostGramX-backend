export type ComponentGroupId =
  | 'users'
  | 'product'
  | 'yandex'
  | 'levanta'
  | 'analytics'
  | 'export'
  | 'import'
  | 'database'
  | 'reference'
  | 'admin';

export type ComponentPageName =
  | 'partnerOverview'
  | 'yandexMarket'
  | 'yandexCsvImport'
  | 'internalProductOverview'
  | 'itemAnalyticsOverview'
  | 'productRegionOverview'
  | 'internalProductCategoryOverview'
  | 'countryCodeOverview'
  | 'bookingExplorer'
  | 'wishOverview'
  | 'userExplorer'
  | 'surveyExplorer'
  | 'levantaStorefronts'
  | 'levantaProducts'
  | 'internalProductCleanup'
  | 'productModeration'
  | 'csvModeratedImport'
  | 'csvImport'
  | 'partnerSqlExport'
  | 'jsonImport'
  | 'databaseTransfer'
  | 'internalProductTransfer'
  | 'adminAccess';

type IconName = string | undefined;

export type ComponentGroupPage = {
  name: ComponentPageName;
  label: string;
  icon?: IconName;
  description?: string;
};

export type ComponentGroupDefinition = {
  id: ComponentGroupId;
  label: string;
  description?: string;
  icon?: IconName;
  pages: ComponentGroupPage[];
};

export type ComponentPageMeta = ComponentGroupPage & {
  groupId: ComponentGroupId;
};

export const COMPONENT_GROUPS: ComponentGroupDefinition[] = [
  {
    id: 'users',
    label: 'Users',
    description: 'User overviews, wishlists, bookings, and surveys.',
    icon: 'User',
    pages: [
      {
        name: 'userExplorer',
        label: 'Users',
        icon: 'User',
        description: 'User search and messaging.',
      },
      {
        name: 'bookingExplorer',
        label: 'Bookings',
        icon: 'Bookmark',
        description: 'Monitor active and completed bookings.',
      },
      {
        name: 'wishOverview',
        label: 'Wishlist',
        icon: 'Gift',
        description: 'Summary of gifts and wishlists.',
      },
      {
        name: 'surveyExplorer',
        label: 'Surveys',
        icon: 'Document',
        description: 'Manage user surveys.',
      },
    ],
  },
  {
    id: 'product',
    label: 'Products',
    description: 'Catalogs, categories, partners, and product maintenance.',
    icon: 'Package',
    pages: [
      {
        name: 'partnerOverview',
        label: 'Partners',
        icon: 'Users',
        description: 'Partner data and offers.',
      },
      {
        name: 'internalProductOverview',
        label: 'Products',
        icon: 'Package',
        description: 'Internal product catalog and booking stats.',
      },
      {
        name: 'internalProductCategoryOverview',
        label: 'Product categories',
        icon: 'Layers',
        description: 'Internal product categories and tags.',
      },
      {
        name: 'internalProductCleanup',
        label: 'Product cleanup',
        icon: 'Trash',
        description: 'Tools for maintaining product cards.',
      },
      {
        name: 'productModeration',
        label: 'Product moderation',
        icon: 'CheckCircle',
        description: 'Fast moderation of product cards and status control.',
      },
      {
        name: 'internalProductTransfer',
        label: 'Product transfer',
        icon: 'Package',
        description: 'Export and import internal products.',
      },
    ],
  },
  {
    id: 'yandex',
    label: 'Yandex Market',
    description: 'Card search and import from Market.',
    icon: 'ShoppingCart',
    pages: [
      {
        name: 'yandexMarket',
        label: 'Yandex Market',
        icon: 'ShoppingCart',
        description: 'Import cards from Market and create products.',
      },
      {
        name: 'yandexCsvImport',
        label: 'Yandex CSV',
        icon: 'Table',
        description: 'Step-by-step product import from CSV.',
      },
    ],
  },
  {
    id: 'levanta',
    label: 'Levanta',
    description: 'Levanta integrations and creator storefront data.',
    icon: 'ShoppingCart',
    pages: [
      {
        name: 'levantaStorefronts',
        label: 'Brand storefronts',
        icon: 'ShoppingCart',
        description: 'Browse Levanta brand storefronts and marketplaces.',
      },
      {
        name: 'levantaProducts',
        label: 'Product catalog',
        icon: 'Package',
        description: 'Browse Levanta products with filters and sorting.',
      },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    description: 'Product metrics and region references.',
    icon: 'BarChart',
    pages: [
      {
        name: 'itemAnalyticsOverview',
        label: 'Item analytics',
        icon: 'BarChart',
        description: 'Track item metrics and events.',
      },
      {
        name: 'productRegionOverview',
        label: 'Product regions',
        icon: 'Map',
        description: 'Availability region reference.',
      },
    ],
  },
  {
    id: 'export',
    label: 'Export',
    description: 'Export partner and product data.',
    icon: 'Download',
    pages: [
      {
        name: 'partnerSqlExport',
        label: 'Partner SQL export',
        icon: 'Download',
        description: 'SQL dump of the selected partner and its products.',
      },
    ],
  },
  {
    id: 'import',
    label: 'Import',
    description: 'CSV and JSON upload tools.',
    icon: 'Upload',
    pages: [
      {
        name: 'csvImport',
        label: 'CSV import',
        icon: 'Document',
        description: 'Upload and process CSV with internal products.',
      },
      {
        name: 'csvModeratedImport',
        label: 'CSV import (step-by-step)',
        icon: 'CheckCircle',
        description:
          'Sequential CSV import with preview, similar to Product Moderate.',
      },
      {
        name: 'jsonImport',
        label: 'JSON import',
        icon: 'Document',
        description: 'Import JSON product structure.',
      },
    ],
  },
  {
    id: 'database',
    label: 'Database',
    description: 'Database maintenance and transfer.',
    icon: 'Database',
    pages: [
      {
        name: 'databaseTransfer',
        label: 'Database transfer',
        icon: 'Database',
        description: 'Transfer data between instances.',
      },
    ],
  },
  {
    id: 'reference',
    label: 'Reference',
    description: 'Additional reference data and codes.',
    icon: 'Globe',
    pages: [
      {
        name: 'countryCodeOverview',
        label: 'Country codes',
        icon: 'Globe',
        description: 'Manage the phone code reference.',
      },
    ],
  },
  {
    id: 'admin',
    label: 'Administration',
    description: 'Create administrators and grant access rights.',
    icon: 'Shield',
    pages: [
      {
        name: 'adminAccess',
        label: 'Administrators',
        icon: 'Shield',
        description: 'Manage view and edit permissions for pages.',
      },
    ],
  },
];

export const COMPONENT_PAGE_META: Record<ComponentPageName, ComponentPageMeta> =
  COMPONENT_GROUPS.reduce(
    (acc, group) => {
      group.pages.forEach((page) => {
        acc[page.name] = { ...page, groupId: group.id };
      });
      return acc;
    },
    {} as Record<ComponentPageName, ComponentPageMeta>,
  );
