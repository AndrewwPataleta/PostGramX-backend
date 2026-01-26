import {
  normalizeLanguage,
  type SupportedLanguage,
} from '../../../common/i18n/supported-languages';

export const ADMIN_LANGUAGES: SupportedLanguage[] = ['en', 'ru'];

export const normalizeAdminLanguage = (
  language?: string | null,
): SupportedLanguage => {
  const normalized = normalizeLanguage(language);
  return ADMIN_LANGUAGES.includes(normalized) ? normalized : 'en';
};
