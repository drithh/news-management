import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_METADATA_KEY = 'idempotent';

export interface IdempotentOptions {
  /**
   * Time to live in seconds for the idempotency key
   * @default 86400 (24 hours)
   */
  ttl?: number;
}

/**
 * Decorator to mark a route as idempotent.
 * Requests with the same Idempotency-Key header will return the cached response.
 *
 * @param options - Configuration options
 * @example
 * ```typescript
 * @Post()
 * @Idempotent({ ttl: 3600 })
 * createResource(@Body() dto: CreateDto) {
 *   // Handler logic
 * }
 * ```
 */
export const Idempotent = (options: IdempotentOptions = {}) =>
  SetMetadata(IDEMPOTENT_METADATA_KEY, options);

