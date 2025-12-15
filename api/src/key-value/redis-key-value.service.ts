import { Injectable, Inject, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { KeyValuePort } from '@/key-value/key-value.port';
import { REDIS_CLIENT } from '@/redis/redis.module';

/**
 * Redis implementation of the KeyValuePort.
 * Adapter that connects the application core to Redis infrastructure.
 */
@Injectable()
export class RedisKeyValueService implements KeyValuePort, OnModuleDestroy {
  private readonly logger = new Logger(RedisKeyValueService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService
  ) {
    this.redis.on('error', (error) => {
      this.logger.error(`Redis error: ${error.message}`, error.stack);
    });

    this.redis.on('connect', () => {
      this.logger.log('Redis connected');
    });
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key);
    } catch (error) {
      this.logger.error(`Failed to GET key ${key}: ${error.message}`);
      throw error;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      await this.redis.set(key, value);
    } catch (error) {
      this.logger.error(`Failed to SET key ${key}: ${error.message}`);
      throw error;
    }
  }

  async setex(key: string, ttl: number, value: string): Promise<void> {
    try {
      await this.redis.setex(key, ttl, value);
    } catch (error) {
      this.logger.error(
        `Failed to SETEX key ${key} with TTL ${ttl}: ${error.message}`
      );
      throw error;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      const result = await this.redis.del(key);
      return result > 0;
    } catch (error) {
      this.logger.error(`Failed to DEL key ${key}: ${error.message}`);
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(
        `Failed to check EXISTS for key ${key}: ${error.message}`
      );
      throw error;
    }
  }

  async setnx(key: string, value: string): Promise<boolean> {
    try {
      const result = await this.redis.setnx(key, value);
      return result === 1;
    } catch (error) {
      this.logger.error(`Failed to SETNX key ${key}: ${error.message}`);
      throw error;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.redis.ttl(key);
    } catch (error) {
      this.logger.error(`Failed to get TTL for key ${key}: ${error.message}`);
      throw error;
    }
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const result = await this.redis.expire(key, ttl);
      return result === 1;
    } catch (error) {
      this.logger.error(
        `Failed to set EXPIRE on key ${key} with TTL ${ttl}: ${error.message}`
      );
      throw error;
    }
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting Redis client');
    await this.redis.quit();
  }
}
