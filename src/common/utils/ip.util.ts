import { Logger } from '@nestjs/common';
import { request as httpsRequest } from 'https';
import type { Request } from 'express';

export function normalizeIp(ip: string): string {
  if (!ip) {
    return '';
  }

  let normalized = ip.trim();

  if (!normalized) {
    return '';
  }

  if (normalized.startsWith('::ffff:')) {
    normalized = normalized.substring(7);
  }

  if (normalized.includes('%')) {
    normalized = normalized.split('%')[0] ?? '';
  }

  if (normalized.includes(':') && normalized.includes('.')) {
    const possibleIpv4 = normalized.split(':').pop();
    if (possibleIpv4 && possibleIpv4.includes('.')) {
      normalized = possibleIpv4;
    }
  }

  return normalized;
}

export function extractIpFromHeader(
  value: string | string[] | undefined,
): string | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    for (const part of value) {
      const normalized = normalizeIp(part);
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }

  const segments = value
    .split(',')
    .map((segment) => normalizeIp(segment))
    .filter((segment) => segment.length > 0);

  return segments.length ? segments[0] : null;
}

export function extractClientIp(req: Request): string | null {
  const headerCandidates = ['x-client-ip', 'x-forwarded-for', 'x-real-ip'];
  const headers = (req.headers ?? {}) as Record<
    string,
    string | string[] | undefined
  >;

  for (const headerKey of headerCandidates) {
    const extracted = extractIpFromHeader(headers[headerKey]);
    if (extracted) {
      return extracted;
    }
  }

  if (req.ip) {
    const normalized = normalizeIp(req.ip);
    if (normalized) {
      return normalized;
    }
  }

  if (req.socket?.remoteAddress) {
    const normalized = normalizeIp(req.socket.remoteAddress);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export function lookupCountryIso(
  ip: string,
  logger?: Logger,
): Promise<string | null> {
  const normalizedIp = normalizeIp(ip);

  if (!normalizedIp) {
    return Promise.resolve(null);
  }

  const url = `https://ipapi.co/${encodeURIComponent(normalizedIp)}/country/`;

  return new Promise((resolve) => {
    let settled = false;
    const safeResolve = (value: string | null) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const request = httpsRequest(
      url,
      {
        method: 'GET',
        headers: {
          'User-Agent': 'postgramx-backend/1.0',
          Accept: 'text/plain',
        },
      },
      (response) => {
        if (!response) {
          safeResolve(null);
          return;
        }

        if (
          response.statusCode &&
          (response.statusCode < 200 || response.statusCode >= 300)
        ) {
          response.resume();
          logger?.debug?.(
            `IP lookup request failed with status ${response.statusCode} for IP ${normalizedIp}`,
          );
          safeResolve(null);
          return;
        }

        response.setEncoding('utf8');
        let data = '';

        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          const trimmed = data.trim();
          if (/^[A-Z]{2}$/i.test(trimmed)) {
            safeResolve(trimmed.toLowerCase());
          } else {
            safeResolve(null);
          }
        });
      },
    );

    request.on('error', (error) => {
      logger?.debug?.(
        `Failed to fetch ISO code for IP ${normalizedIp}: ${error.message}`,
      );
      safeResolve(null);
    });

    request.setTimeout(1500, () => {
      logger?.debug?.(`ISO lookup request timed out for IP ${normalizedIp}`);
      request.destroy();
      safeResolve(null);
    });

    request.end();
  });
}
