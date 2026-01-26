import { ADMIN_ROOT_PATH } from '../config/paths';

const normalizeRootPath = (rootPath: string): string => {
  if (!rootPath.length) {
    return '/';
  }
  const trimmed = rootPath.trim();
  const withLeadingSlash = trimmed.startsWith('/')
    ? trimmed
    : `/${trimmed}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/$/u, '');
  return withoutTrailingSlash.length ? withoutTrailingSlash : '/';
};

const trimSlashes = (value: string): string => value.replace(/^\/+/u, '').replace(/\/+$/u, '');

export const buildAdminPageUrl = (pageName: string): string => {
  const rootPath = normalizeRootPath(ADMIN_ROOT_PATH);
  const pageSegment = trimSlashes(pageName);
  return `${rootPath}/pages/${pageSegment}`.replace(/\/{2,}/gu, '/');
};
