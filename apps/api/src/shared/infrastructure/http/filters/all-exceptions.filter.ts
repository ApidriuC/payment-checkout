import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

export interface ErrorResponseBody {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  path: string;
  timestamp: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();

    const body = this.buildBody(exception, request.url);

    if (body.statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${body.statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(body.statusCode).json(body);
  }

  private buildBody(exception: unknown, path: string): ErrorResponseBody {
    const timestamp = new Date().toISOString();

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const payload = exception.getResponse();

      if (typeof payload === 'string') {
        return {
          statusCode,
          code: this.fallbackCode(statusCode),
          message: payload,
          path,
          timestamp,
        };
      }

      const record = payload as Record<string, unknown>;

      return {
        statusCode,
        code: typeof record.code === 'string' ? record.code : this.fallbackCode(statusCode),
        message: this.normalizeMessage(record.message) ?? exception.message,
        ...(record.details !== undefined ? { details: record.details } : {}),
        path,
        timestamp,
      };
    }

    // Unhandled failures are logged above; the client never sees internals.
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
      path,
      timestamp,
    };
  }

  private normalizeMessage(message: unknown): string | undefined {
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join('; ');
    return undefined;
  }

  private fallbackCode(statusCode: number): string {
    return HttpStatus[statusCode] ?? 'ERROR';
  }
}
