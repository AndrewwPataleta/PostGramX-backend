const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) {
    return fallback;
  }

  return value === 'true';
};

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

export const MTPROTO_MONITOR_CONFIG = {
  ENABLED: parseBoolean(process.env.MTPROTO_ENABLED, true),
  API_ID: Number(process.env.MTPROTO_API_ID ?? 0),
  API_HASH: process.env.MTPROTO_API_HASH ?? '',
  SESSION: process.env.MTPROTO_SESSION ?? '',
  PHONE: process.env.MTPROTO_PHONE ?? '',
  POLL_CRON: process.env.MTPROTO_POLL_CRON ?? '*/30 * * * * *',
  MAX_PARALLEL: parseNumber(process.env.MTPROTO_MAX_PARALLEL, 5),
  PROVIDER: process.env.TELEGRAM_POST_VERIFY_PROVIDER ?? 'mtproto',
  PEER_CACHE_MINUTES: parseNumber(process.env.MTPROTO_PEER_CACHE_MINUTES, 10),
};
