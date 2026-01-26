export const adminLocaleTranslations = {
  en: {
    labels: {
      pages: 'Components',
    },
    pages: {
      csvImport: 'CSV import',
      csvModeratedImport: 'CSV import (step-by-step)',
      jsonImport: 'JSON import',
      databaseTransfer: 'Database transfer',
      internalProductTransfer: 'Product transfer',
      partnerOverview: 'Partners',
      internalProductOverview: 'Products',
      itemAnalyticsOverview: 'Item analytics',
      productRegionOverview: 'Product regions',
      internalProductCategoryOverview: 'Product categories',
      bookingExplorer: 'Bookings',
      wishOverview: 'Wishlist',
      userExplorer: 'Users',
      countryCodeOverview: 'Country codes',
      internalProductCleanup: 'Product cleanup',
      productModeration: 'Product moderation',
      levantaStorefronts: 'Levanta storefronts',
      levantaProducts: 'Levanta products',
      adminAccess: 'Admin access',
    },
    properties: {
      'tags.addNewItem': 'Add tag',
      'categories.addNewItem': 'Add category',
      '[1]': '1',
    },
    resources: {
      InternalProduct: {
        properties: {
          name: 'Name',
          description: 'Description',
          link: 'Product link',
          price: 'Price',
          currency: 'Currency',
          imageUrl: 'Image URL',
          hidden: 'Hidden',
          productRegion: 'Product region',
          categories: 'Categories',
          'categories.addNewItem': 'Add category',
          tags: 'Tags',
          'tags.addNewItem': 'Add tag',
        },
      },
    },
    messages: {
      'null value in column "link" of relation "internal_product" violates not-null constraint':
        'Please fill the “Product link” field (required).',
      'null value in column "price" of relation "internal_product" violates not-null constraint':
        'Please fill the “Price” field (required).',
      'null value in column "currency_key" of relation "internal_product" violates not-null constraint':
        'Please select the “Currency” field (required).',
    },
  },
  ru: {
    labels: {
      pages: 'Components',
    },
    pages: {
      csvImport: 'CSV import',
      csvModeratedImport: 'CSV import (step-by-step)',
      jsonImport: 'JSON import',
      databaseTransfer: 'Database transfer',
      internalProductTransfer: 'Product transfer',
      partnerOverview: 'Partners',
      internalProductOverview: 'Products',
      itemAnalyticsOverview: 'Item analytics',
      productRegionOverview: 'Product regions',
      internalProductCategoryOverview: 'Product categories',
      bookingExplorer: 'Bookings',
      wishOverview: 'Wishlist',
      userExplorer: 'Users',
      countryCodeOverview: 'Country codes',
      internalProductCleanup: 'Product cleanup',
      productModeration: 'Product moderation',
      levantaStorefronts: 'Levanta storefronts',
      levantaProducts: 'Levanta products',
      adminAccess: 'Admin access',
    },
    properties: {
      'tags.addNewItem': 'Add tag',
      'categories.addNewItem': 'Add category',
      '[1]': '1',
    },
    resources: {
      InternalProduct: {
        properties: {
          name: 'Name',
          description: 'Description',
          link: 'Product link',
          price: 'Price',
          currency: 'Currency',
          imageUrl: 'Image URL',
          hidden: 'Hidden',
          productRegion: 'Product region',
          categories: 'Categories',
          'categories.addNewItem': 'Add category',
          tags: 'Tags',
          'tags.addNewItem': 'Add tag',
        },
      },
    },
    messages: {
      'null value in column "link" of relation "internal_product" violates not-null constraint':
        'Please fill the “Product link” field (required).',
      'null value in column "price" of relation "internal_product" violates not-null constraint':
        'Please fill the “Price” field (required).',
      'null value in column "currency_key" of relation "internal_product" violates not-null constraint':
        'Please select the “Currency” field (required).',
    },
  },
} as const;
