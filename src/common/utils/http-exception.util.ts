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

export async function buildI18nHttpExceptionPayload(
  i18n: I18nService | I18nContext,
  key: string,
  options?: TranslateOptions,
  extra: Record<string, unknown> = {},
): Promise<HttpExceptionPayload> {
  const message = await i18n.t(key, options);
  // @ts-ignore
  return buildHttpExceptionPayload(key, message, extra);
}
