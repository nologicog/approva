import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { Injectable, NestMiddleware } from '@nestjs/common';
import { RequestContextService } from './request-context.service';
import { StructuredLoggerService } from './structured-logger.service';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  constructor(
    private readonly requestContextService: RequestContextService,
    private readonly logger: StructuredLoggerService,
  ) {}

  use(request: Request, response: Response, next: NextFunction) {
    const startedAt = Date.now();
    const requestId = this.readHeader(request, 'x-request-id') ?? randomUUID();
    const organizationId = this.readHeader(request, 'x-authon-organization-id');
    const userId = this.readHeader(request, 'x-authon-dashboard-user-id');
    const initialPath = this.normalizePath(request.originalUrl ?? request.url);

    response.setHeader('x-request-id', requestId);

    this.requestContextService.run(
      {
        requestId,
        organizationId,
        approvalRequestId: null,
        userId,
        method: request.method,
        path: initialPath,
      },
      () => {
        response.on('finish', () => {
          this.logger.log(
            {
              event: 'request_completed',
              method: request.method,
              path: initialPath,
              statusCode: response.statusCode,
              durationMs: Date.now() - startedAt,
            },
            'HttpRequest',
          );
        });

        next();
      },
    );
  }

  private readHeader(request: Request, name: string) {
    const value = request.headers[name];

    if (Array.isArray(value)) {
      return value[0]?.trim() || null;
    }

    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
  }

  private normalizePath(url: string) {
    const [pathname] = url.split('?');
    return pathname || '/';
  }
}
