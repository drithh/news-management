import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, of } from 'rxjs';
import { switchMap, tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { IdempotencyService } from '@/idempotency/idempotency.service';
import { IDEMPOTENT_METADATA_KEY } from '@/idempotency/idempotent.decorator';

export interface IdempotentOptions {
  ttl?: number;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    private readonly idempotencyService: IdempotencyService,
    private readonly reflector: Reflector
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Check if route has @Idempotent decorator
    const options = this.reflector.get<IdempotentOptions>(
      IDEMPOTENT_METADATA_KEY,
      context.getHandler()
    );

    // Skip if decorator not present
    if (!options) {
      return next.handle();
    }

    // Get idempotency key from header
    const idempotencyKey = request.headers['idempotency-key'] as string;

    // Skip if no idempotency key provided
    if (!idempotencyKey) {
      return next.handle();
    }

    // Build resource path
    const resourcePath = `${request.method}:${request.path}`;

    this.logger.debug(
      `Processing idempotency key: ${idempotencyKey} for ${resourcePath}`
    );

    // Check and claim the idempotency key
    return from(
      this.idempotencyService.checkAndClaim(
        idempotencyKey,
        resourcePath,
        options.ttl
      )
    ).pipe(
      switchMap((result) => {
        if (result.status === 'COMPLETED') {
          // Return cached response
          this.logger.debug(
            `Returning cached response for key ${idempotencyKey}`
          );
          response.status(result.responseCode || 200);
          return of(result.responseBody);
        }

        if (result.status === 'IN_PROGRESS') {
          // Another request is processing this
          throw new ConflictException(
            'A request with this idempotency key is already being processed'
          );
        }

        // NEW - proceed with handler
        return next.handle().pipe(
          tap(async (handlerResponse) => {
            // Store the successful response
            const statusCode = response.statusCode;
            await this.idempotencyService.complete(
              idempotencyKey,
              resourcePath,
              statusCode,
              handlerResponse,
              options.ttl
            );
          }),
          catchError(async (error) => {
            // Mark as failed to allow retry
            this.logger.warn(
              `Handler failed for idempotency key ${idempotencyKey}: ${error.message}`
            );
            await this.idempotencyService.fail(idempotencyKey, resourcePath);
            throw error;
          })
        );
      })
    );
  }
}
