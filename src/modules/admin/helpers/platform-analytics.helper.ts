export const KNOWN_PLATFORMS = ['android', 'ios', 'telegram'] as const;

export type KnownPlatform = (typeof KNOWN_PLATFORMS)[number];

export type PlatformBreakdown = Record<KnownPlatform | 'other', number>;

const KNOWN_PLATFORM_SET = new Set<string>(KNOWN_PLATFORMS);

export type RawPlatformRow = {
  platform?: string | null;
  count?: string | number | null;
};

export const CHART_RANGE_DAYS = 30;

export type RawPlatformGrowthRow = RawPlatformRow & {
  day?: Date | string | null;
};

export type RawCountRow = {
  day?: Date | string | null;
  count?: string | number | null;
};

export type PlatformTimeSeriesPoint = {
  day: string;
  breakdown: PlatformBreakdown;
};

export type CountTimeSeriesPoint = {
  day: string;
  value: number;
};

export function createPlatformBreakdown(
  rows: RawPlatformRow[],
): PlatformBreakdown {
  return rows.reduce<PlatformBreakdown>(
    (acc, row) => {
      const normalizedPlatform =
        typeof row.platform === 'string' ? row.platform.toLowerCase() : 'other';
      const platformKey = KNOWN_PLATFORM_SET.has(normalizedPlatform)
        ? (normalizedPlatform as KnownPlatform)
        : 'other';

      const numericCount = Number(row.count ?? 0);
      if (Number.isFinite(numericCount)) {
        acc[platformKey] += numericCount;
      }

      return acc;
    },
    {
      android: 0,
      ios: 0,
      telegram: 0,
      other: 0,
    },
  );
}

export function toDayKey(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : new Date(value.getTime()).toISOString().slice(0, 10);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime())
      ? null
      : parsed.toISOString().slice(0, 10);
  }

  if (value == null) {
    return null;
  }

  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime())
    ? null
    : parsed.toISOString().slice(0, 10);
}

export function createDayKeys(rangeDays: number, endDateUtc: Date): string[] {
  const keys: string[] = [];
  const end = new Date(endDateUtc.getTime());
  end.setUTCHours(0, 0, 0, 0);

  for (let i = rangeDays - 1; i >= 0; i -= 1) {
    const current = new Date(end.getTime());
    current.setUTCDate(end.getUTCDate() - i);
    current.setUTCHours(0, 0, 0, 0);
    keys.push(current.toISOString().slice(0, 10));
  }

  return keys;
}

export function buildPlatformTimeSeries(
  dayKeys: string[],
  rows: RawPlatformGrowthRow[],
): PlatformTimeSeriesPoint[] {
  const grouped = new Map<string, RawPlatformRow[]>();

  for (const row of rows) {
    const dayKey = toDayKey(row.day);
    if (!dayKey) continue;
    const existing = grouped.get(dayKey);
    if (existing) {
      existing.push({ platform: row.platform, count: row.count });
    } else {
      grouped.set(dayKey, [{ platform: row.platform, count: row.count }]);
    }
  }

  return dayKeys.map((day) => ({
    day,
    breakdown: createPlatformBreakdown(grouped.get(day) ?? []),
  }));
}

export function buildCountTimeSeries(
  dayKeys: string[],
  rows: RawCountRow[],
): CountTimeSeriesPoint[] {
  const grouped = new Map<string, number>();

  for (const row of rows) {
    const dayKey = toDayKey(row.day);
    if (!dayKey) continue;
    const numericCount = Number(row.count ?? 0);
    if (!Number.isFinite(numericCount)) continue;
    grouped.set(dayKey, (grouped.get(dayKey) ?? 0) + numericCount);
  }

  return dayKeys.map((day) => ({
    day,
    value: grouped.get(day) ?? 0,
  }));
}
