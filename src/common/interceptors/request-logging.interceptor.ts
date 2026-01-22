import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('RequestLogger');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request | undefined>();

    if (!request) {
      return next.handle();
    }

    const handlerName = `${context.getClass().name}.${context.getHandler().name}`;
    const method = request.method;
    const path = request.originalUrl ?? request.url ?? 'unknown';

    const username = this.extractUsername(request);
    const platform = this.extractPlatform(request);
    const ip = this.extractClientIp(request);
    const region = this.extractRegion(request);
    const requestId = this.extractHeader(request, ['x-request-id']);
    const body = this.extractBodyParameters(request);

    const startedAt = Date.now();

    this.logger.log(
      this.buildLogMessage('REQUEST', {
        handler: handlerName,
        method,
        path,
        username,
        platform,
        ip,
        region,
        requestId,
        body,
      }),
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const response = httpContext.getResponse<Response | undefined>();
          const statusCode = response?.statusCode ?? 200;
          this.logger.log(
            this.buildLogMessage('RESPONSE', {
              handler: handlerName,
              method,
              path,
              statusCode,
              durationMs: Date.now() - startedAt,
              username,
              platform,
              ip,
              region,
              requestId,
            }),
          );
        },
        error: (error: unknown) => {
          const response = httpContext.getResponse<Response | undefined>();
          const statusCode =
            response?.statusCode ?? this.extractErrorStatus(error) ?? 'error';
          this.logger.error(
            this.buildLogMessage('RESPONSE_ERROR', {
              handler: handlerName,
              method,
              path,
              statusCode,
              durationMs: Date.now() - startedAt,
              username,
              platform,
              ip,
              region,
              requestId,
              error: this.extractErrorMessage(error),
            }),
          );
        },
      }),
    );
  }

  private extractBodyParameters(req: Request): unknown {
    const body = (req as { body?: unknown }).body;

    if (body === undefined || body === null) {
      return undefined;
    }

    if (Buffer.isBuffer(body)) {
      return '[binary-body-omitted]';
    }

    if (typeof body === 'string') {
      const trimmed = body.trim();
      if (!trimmed) {
        return undefined;
      }

      const parsed = this.tryParseJson(trimmed);
      return parsed ?? trimmed;
    }

    if (Array.isArray(body)) {
      return body.map((item) => this.normalizeBodyValue(item));
    }

    if (this.isPlainObject(body)) {
      return Object.fromEntries(
        Object.entries(body as Record<string, unknown>).map(([key, value]) => [
          key,
          this.normalizeBodyValue(value),
        ]),
      );
    }

    return this.normalizeBodyValue(body);
  }

  private normalizeBodyValue(value: unknown): unknown {
    if (value === undefined || value === null) {
      return value;
    }

    if (Buffer.isBuffer(value)) {
      return '[binary-body-omitted]';
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.normalizeBodyValue(item));
    }

    if (this.isPlainObject(value)) {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(
          ([key, nested]) => [key, this.normalizeBodyValue(nested)],
        ),
      );
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return value;
      }

      const parsed = this.tryParseJson(trimmed);
      return parsed ?? value;
    }

    return value;
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
  }

  private tryParseJson(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  private buildLogMessage(
    prefix: string,
    payload: Record<string, unknown>,
  ): string {
    return `${prefix} ${JSON.stringify(
      Object.fromEntries(
        Object.entries(payload).filter(
          ([, value]) => value !== undefined && value !== null,
        ),
      ),
    )}`;
  }

  private extractUsername(req: Request): string {
    const user = req.user as
      | { username?: string | null; email?: string | null; id?: string | null }
      | undefined;

    const username = user?.username?.trim();
    if (username) {
      return username;
    }

    const email = user?.email?.trim();
    if (email) {
      return email;
    }

    const id = user?.id?.trim();
    if (id) {
      return id;
    }

    const headerUsername = this.extractHeader(req, [
      'x-user-name',
      'x-username',
    ]);
    if (headerUsername) {
      return headerUsername;
    }

    return 'anonymous';
  }

  private extractPlatform(req: Request): string {
    const user = req.user as { platformType?: string | null } | undefined;
    const platform = user?.platformType?.trim();
    if (platform) {
      return platform;
    }

    const headerPlatform = this.extractHeader(req, [
      'x-platform',
      'x-client-platform',
      'x-app-platform',
      'x-device-platform',
    ]);
    if (headerPlatform) {
      return headerPlatform;
    }

    return 'unknown';
  }

  private extractRegion(req: Request): string {
    const headerRegion = this.extractHeader(req, [
      'x-app-region',
      'x-region',
      'cf-ipcountry',
      'x-vercel-ip-country',
      'x-country',
      'x-geo-region',
    ]);
    if (headerRegion) {
      return headerRegion;
    }

    const user = req.user as
      | { region?: string | null; settings?: { region?: string | null } }
      | undefined;
    const userRegion = user?.region?.trim() ?? user?.settings?.region?.trim();
    if (userRegion) {
      return userRegion;
    }

    return 'unknown';
  }

  private extractClientIp(req: Request): string {
    const headerCandidate = this.extractHeader(req, [
      'x-client-ip',
      'x-forwarded-for',
      'x-real-ip',
    ]);
    if (headerCandidate) {
      const first = headerCandidate.split(',')[0]?.trim();
      if (first) {
        return this.normalizeIp(first);
      }
    }

    if (req.ip) {
      return this.normalizeIp(req.ip);
    }

    const connectionAddress = (
      req.connection as { remoteAddress?: string | null } | undefined
    )?.remoteAddress;
    if (connectionAddress) {
      return this.normalizeIp(connectionAddress);
    }

    const socketAddress = req.socket?.remoteAddress;
    if (socketAddress) {
      return this.normalizeIp(socketAddress);
    }

    return 'unknown';
  }

  private normalizeIp(ip: string): string {
    if (!ip) {
      return 'unknown';
    }

    let normalized = ip.trim();

    if (normalized.startsWith('::ffff:')) {
      normalized = normalized.substring(7);
    }

    if (normalized.includes('%')) {
      normalized = normalized.split('%')[0] ?? normalized;
    }

    if (normalized.includes(':') && normalized.includes('.')) {
      const maybeIpv4 = normalized.split(':').pop();
      if (maybeIpv4 && maybeIpv4.includes('.')) {
        normalized = maybeIpv4;
      }
    }

    return normalized;
  }

  private extractHeader(req: Request, keys: string[]): string | null {
    for (const key of keys) {
      const headerKey = key.toLowerCase();
      const value = req.headers?.[headerKey];
      if (!value) {
        continue;
      }

      if (Array.isArray(value)) {
        const first = value.find(
          (entry) => !!entry && String(entry).trim().length > 0,
        );
        if (first) {
          return String(first).trim();
        }
        continue;
      }

      const trimmed = String(value).trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }

    return null;
  }

  private extractErrorStatus(error: unknown): number | null {
    if (!error || typeof error !== 'object') {
      return null;
    }

    const maybeStatus =
      (error as { status?: number; statusCode?: number }).status ??
      (error as { status?: number; statusCode?: number }).statusCode;
    if (typeof maybeStatus === 'number') {
      return maybeStatus;
    }

    return null;
  }

  private extractErrorMessage(error: unknown): string {
    if (!error) {
      return 'Unknown error';
    }

    if (typeof error === 'string') {
      return error;
    }

    if (error instanceof Error) {
      return error.message;
    }

    if (
      typeof error === 'object' &&
      'message' in error &&
      typeof (error as { message: unknown }).message === 'string'
    ) {
      return (error as { message: string }).message;
    }

    return JSON.stringify(error);
  }
}
