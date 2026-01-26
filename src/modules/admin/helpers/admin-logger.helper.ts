import { AdminActionBeforeHook } from '../types/admin.types';

export const adminLog = {
  log: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

export function safeStringify(obj: unknown, maxLen = 10000): string {
  try {
    const s = JSON.stringify(obj, (_k, v) => {
      if (typeof v === 'string' && v.length > 500) return `${v.slice(0, 500)}…`;
      return v;
    });
    return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
  } catch {
    return String(obj);
  }
}

export const logBefore = (label: string): AdminActionBeforeHook => async (
  request,
) => {
  return request;
};

export const logAfterBefore = (
  label: string,
): AdminActionBeforeHook => async (request) => {
  return request;
};

export function composeBefore(
  ...hooks: AdminActionBeforeHook[]
): AdminActionBeforeHook {
  return async (request, context) => {
    let current = request;
    for (const hook of hooks) {
      current = await hook(current, context);
    }
    return current;
  };
}
