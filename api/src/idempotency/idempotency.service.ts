import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { KeyValuePort, KEY_VALUE_PORT } from '@/key-value/key-value.port';
import {
  IdempotencyKey,
  IdempotencyStatus,
} from '@/idempotency/idempotency-key.entity';

export interface IdempotencyCheckResult {
  status: 'NEW' | 'COMPLETED' | 'IN_PROGRESS';
  responseCode?: number;
  responseBody?: any;
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly defaultTtl: number;

  constructor(
    @Inject(KEY_VALUE_PORT) private readonly keyValue: KeyValuePort,
    @InjectRepository(IdempotencyKey)
    private readonly idempotencyRepo: Repository<IdempotencyKey>,
    private readonly configService: ConfigService
  ) {
    this.defaultTtl = this.configService.get<number>(
      'IDEMPOTENCY_TTL_SECONDS',
      86400
    );
  }

  /**
   * Check if idempotency key exists and claim it if not
   */
  async checkAndClaim(
    idempotencyKey: string,
    resourcePath: string,
    ttlSeconds?: number
  ): Promise<IdempotencyCheckResult> {
    const ttl = ttlSeconds || this.defaultTtl;
    const redisKey = this.buildRedisKey(resourcePath, idempotencyKey);

    // 1. Check key-value store first (fast path)
    try {
      const cached = await this.keyValue.get(redisKey);
      if (cached) {
        const data = JSON.parse(cached);
        if (data.status === IdempotencyStatus.COMPLETED) {
          return {
            status: 'COMPLETED',
            responseCode: data.responseCode,
            responseBody: data.responseBody,
          };
        }
        if (data.status === IdempotencyStatus.IN_PROGRESS) {
          return { status: 'IN_PROGRESS' };
        }
      }
    } catch (error) {
      this.logger.warn(
        `Key-value store check failed for key ${idempotencyKey}: ${error.message}`
      );
      // Fall through to database check
    }

    // 2. Check Postgres (source of truth)
    const existing = await this.idempotencyRepo.findOne({
      where: { idempotencyKey, resourcePath },
    });

    if (existing) {
      if (existing.status === IdempotencyStatus.COMPLETED) {
        // Cache in key-value store for future requests
        await this.cacheInKeyValue(
          redisKey,
          existing.status,
          existing.responseCode,
          existing.responseBody,
          ttl
        );
        return {
          status: 'COMPLETED',
          responseCode: existing.responseCode,
          responseBody: existing.responseBody,
        };
      }

      if (existing.status === IdempotencyStatus.IN_PROGRESS) {
        return { status: 'IN_PROGRESS' };
      }
    }

    // 3. Insert new record as IN_PROGRESS
    try {
      await this.cacheInKeyValue(
        redisKey,
        IdempotencyStatus.IN_PROGRESS,
        null,
        null,
        ttl
      );

      await this.idempotencyRepo.insert({
        idempotencyKey,
        resourcePath,
        status: IdempotencyStatus.IN_PROGRESS,
      });

      // Also set in key-value store
      return { status: 'NEW' };
    } catch (error) {
      // Handle race condition: another request might have inserted
      if (error.code === '23505') {
        // Unique constraint violation
        this.logger.debug(
          `Race condition detected for key ${idempotencyKey}, re-checking`
        );
        return { status: 'IN_PROGRESS' };
      }
      throw error;
    }
  }

  /**
   * Mark idempotency key as completed with response
   */
  async complete(
    idempotencyKey: string,
    resourcePath: string,
    responseCode: number,
    responseBody: any,
    ttlSeconds?: number
  ): Promise<void> {
    const ttl = ttlSeconds || this.defaultTtl;

    // Update database
    await this.idempotencyRepo.update(
      { idempotencyKey, resourcePath },
      {
        status: IdempotencyStatus.COMPLETED,
        responseCode,
        responseBody,
      }
    );

    // Update key-value cache
    const keyValueKey = this.buildRedisKey(resourcePath, idempotencyKey);
    await this.cacheInKeyValue(
      keyValueKey,
      IdempotencyStatus.COMPLETED,
      responseCode,
      responseBody,
      ttl
    );

    this.logger.debug(`Idempotency key ${idempotencyKey} marked as COMPLETED`);
  }

  /**
   * Mark idempotency key as failed (allows retry)
   */
  async fail(idempotencyKey: string, resourcePath: string): Promise<void> {
    // Delete from database to allow retry
    await this.idempotencyRepo.delete({ idempotencyKey, resourcePath });

    // Delete from key-value store
    const keyValueKey = this.buildRedisKey(resourcePath, idempotencyKey);
    try {
      await this.keyValue.del(keyValueKey);
    } catch (error) {
      this.logger.warn(
        `Failed to delete key-value key ${keyValueKey}: ${error.message}`
      );
    }

    this.logger.debug(`Idempotency key ${idempotencyKey} marked as FAILED`);
  }

  private buildRedisKey(resourcePath: string, idempotencyKey: string): string {
    return `idempotency:${resourcePath}:${idempotencyKey}`;
  }

  private async cacheInKeyValue(
    key: string,
    status: IdempotencyStatus,
    responseCode: number | null,
    responseBody: any,
    ttlSeconds: number
  ): Promise<void> {
    try {
      const data = { status, responseCode, responseBody };
      await this.keyValue.setex(key, ttlSeconds, JSON.stringify(data));
    } catch (error) {
      this.logger.warn(`Failed to cache in key-value store: ${error.message}`);
      // Don't throw - key-value store is just a cache
    }
  }
}
