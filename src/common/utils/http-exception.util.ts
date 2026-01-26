import { I18nContext, I18nService, TranslateOptions } from 'nestjs-i18n';

export type HttpExceptionPayload = {
  key: string;
  message: string | string[];
} & Record<string, unknown>;

export function buildHttpExceptionPayload(
  key: string,
  message: string | string[],
  extra: Record<string, unknown> = {},
): HttpExceptionPayload {
  return {
    key,
    message,
    ...extra,
  };
}

