export function normalizeBooleanFilter(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no'].includes(normalized)) {
      return false;
    }
  }

  return null;
}

export function normalizeStringValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  return null;
}

export function normalizeStringArray(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value
    : value === undefined || value === null
      ? []
      : [value];
  const result: string[] = [];
  for (const entry of values) {
    if (typeof entry === 'string' || typeof entry === 'number') {
      const trimmed = String(entry).trim();
      if (trimmed.length) {
        result.push(trimmed);
      }
    }
  }
  return result;
}

export function normalizeNumberArray(value: unknown): number[] {
  const values = Array.isArray(value)
    ? value
    : value === undefined || value === null
      ? []
      : [value];
  const result: number[] = [];
  for (const entry of values) {
    if (entry === null || entry === undefined || entry === '') {
      continue;
    }
    const parsed =
      typeof entry === 'number' ? entry : Number.parseInt(String(entry), 10);
    if (Number.isFinite(parsed)) {
      result.push(parsed);
    }
  }
  return result;
}

export function parseDateFilter(
  value: unknown,
  options: { endOfDay?: boolean } = {},
): Date | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed.length) {
    return undefined;
  }

  let candidate = trimmed;
  if (!/[tT]/.test(trimmed)) {
    candidate = `${trimmed}T${options.endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`;
  }

  const timestamp = Date.parse(candidate);
  if (Number.isNaN(timestamp)) {
    return undefined;
  }

  return new Date(timestamp);
}

export function normalizePositiveInteger(
  value: unknown,
  options: { min?: number; max?: number } = {},
): number | null {
  const { min = 1, max = Number.MAX_SAFE_INTEGER } = options;
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : null;
  if (parsed == null || Number.isNaN(parsed) || parsed <= 0) {
    return null;
  }
  return Math.min(Math.max(parsed, min), max);
}

export function parsePriceValue(rawValue: unknown): number | null {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  if (typeof rawValue === 'number') {
    if (!Number.isFinite(rawValue) || rawValue < 0) {
      return null;
    }
    return Math.round(rawValue);
  }

  const stringValue = String(rawValue);
  if (!stringValue.trim()) {
    return null;
  }

  const compacted = stringValue.replace(/\s+/g, '').replace(/,/g, '.');
  const sanitized = compacted.replace(/[^0-9.]/g, '.');
  const segments = sanitized.split('.').filter((segment) => segment.length > 0);

  if (!segments.length) {
    return null;
  }

  let normalized = segments.join('.');
  if (segments.length > 1) {
    const fraction = segments.pop() ?? '';
    const integerPart = segments.join('');
    normalized = fraction ? `${integerPart}.${fraction}` : integerPart;
  }

  const parsed = Number.parseFloat(normalized);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return Math.round(parsed);
}

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
