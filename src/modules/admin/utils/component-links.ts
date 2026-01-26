import type { ComponentPageName } from '../config/component-groups';
import { buildAdminPageUrl } from './admin-page-url';

type ComponentQuery = Record<string, string | number | null | undefined>;

const buildQueryString = (params?: ComponentQuery) => {
  if (!params) {
    return '';
  }
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined) {
      return;
    }
    const normalized = String(value).trim();
    if (!normalized.length) {
      return;
    }
    searchParams.set(key, normalized);
  });
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
};

export const buildComponentUrl = (
  page: ComponentPageName,
  params?: ComponentQuery,
): string => {
  const baseUrl = buildAdminPageUrl(page);
  const query = buildQueryString(params);
  return `${baseUrl}${query}`;
};

export const buildUserExplorerUrl = (
  userIdentifier?: string | null,
): string => {
  if (!userIdentifier) {
    return buildComponentUrl('userExplorer');
  }
  return buildComponentUrl('userExplorer', { search: userIdentifier });
};

export const buildPartnerOverviewUrl = (
  partnerIdentifier?: string | null,
): string => {
  if (!partnerIdentifier) {
    return buildComponentUrl('partnerOverview');
  }
  return buildComponentUrl('partnerOverview', { search: partnerIdentifier });
};

export const buildProductRegionOverviewUrl = (
  regionId?: string | null,
): string => {
  if (!regionId) {
    return buildComponentUrl('productRegionOverview');
  }
  return buildComponentUrl('productRegionOverview', { regionId });
};

export const buildInternalProductCategoryOverviewUrl = (
  categoryKey?: string | null,
): string => {
  if (!categoryKey) {
    return buildComponentUrl('internalProductCategoryOverview');
  }
  return buildComponentUrl('internalProductCategoryOverview', { search: categoryKey });
};
