const normalizeEnvValue = (value: string | undefined): string | undefined => {
  if (value === undefined) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.replace(/^['\"]|['\"]$/g, '');
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  const normalizedValue = normalizeEnvValue(value);
  if (normalizedValue === undefined) {
    return fallback;
  }

  return normalizedValue === 'true';
};

const parseNumber = (value: string | undefined, fallback: number): number => {
  const normalizedValue = normalizeEnvValue(value);
  if (normalizedValue === undefined) {
    return fallback;
  }

  const parsed = Number(normalizedValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

export const MTPROTO_MONITOR_CONFIG = {
  ENABLED:process.env.MTPROTO_ENABLED,
  API_ID: process.env.MTPROTO_API_ID,
  API_HASH: normalizeEnvValue(process.env.MTPROTO_API_HASH) ?? '',
  SESSION: normalizeEnvValue(process.env.MTPROTO_SESSION) ?? '',
  PHONE: normalizeEnvValue(process.env.MTPROTO_PHONE) ?? '',
  POLL_CRON:
    normalizeEnvValue(process.env.MTPROTO_POLL_CRON) ?? '*/30 * * * * *',
  MAX_PARALLEL: parseNumber(process.env.MTPROTO_MAX_PARALLEL, 5),
  PROVIDER:
    normalizeEnvValue(process.env.TELEGRAM_POST_VERIFY_PROVIDER) ?? 'mtproto',
  PEER_CACHE_MINUTES: parseNumber(process.env.MTPROTO_PEER_CACHE_MINUTES, 10),
};
