import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { IdempotencyService } from '@/idempotency/idempotency.service';
import {
  IdempotencyKey,
  IdempotencyStatus,
} from '@/idempotency/idempotency-key.entity';
import { KEY_VALUE_PORT, KeyValuePort } from '@/key-value/key-value.port';

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  let keyValue: jest.Mocked<KeyValuePort>;
  let repo: jest.Mocked<Repository<IdempotencyKey>>;
  let config: { get: jest.Mock };

  const defaultTtl = 100;
  const idempotencyKey = 'abc-123';
  const resourcePath = '/articles';
  const redisKey = `idempotency:${resourcePath}:${idempotencyKey}`;

  beforeEach(async () => {
    keyValue = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      setnx: jest.fn(),
      ttl: jest.fn(),
      expire: jest.fn(),
    };

    repo = {
      findOne: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<Repository<IdempotencyKey>>;

    config = { get: jest.fn().mockReturnValue(defaultTtl) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        { provide: KEY_VALUE_PORT, useValue: keyValue },
        { provide: ConfigService, useValue: config },
        { provide: getRepositoryToken(IdempotencyKey), useValue: repo },
      ],
    }).compile();

    service = module.get(IdempotencyService);
  });

  describe('checkAndClaim', () => {
    it('returns COMPLETED from cache without hitting the database', async () => {
      keyValue.get.mockResolvedValue(
        JSON.stringify({
          status: IdempotencyStatus.COMPLETED,
          responseCode: 200,
          responseBody: { ok: true },
        })
      );

      const result = await service.checkAndClaim(idempotencyKey, resourcePath);

      expect(result).toEqual({
        status: 'COMPLETED',
        responseCode: 200,
        responseBody: { ok: true },
      });
      expect(repo.findOne).not.toHaveBeenCalled();
    });

    it('returns IN_PROGRESS from cache', async () => {
      keyValue.get.mockResolvedValue(
        JSON.stringify({ status: IdempotencyStatus.IN_PROGRESS })
      );

      const result = await service.checkAndClaim(idempotencyKey, resourcePath);

      expect(result).toEqual({ status: 'IN_PROGRESS' });
      expect(repo.findOne).not.toHaveBeenCalled();
    });

    it('falls back to database if cache check fails', async () => {
      keyValue.get.mockRejectedValue(new Error('redis down'));
      repo.findOne.mockResolvedValue({
        idempotencyKey,
        resourcePath,
        status: IdempotencyStatus.IN_PROGRESS,
      } as IdempotencyKey);

      const result = await service.checkAndClaim(idempotencyKey, resourcePath);

      expect(result).toEqual({ status: 'IN_PROGRESS' });
      expect(repo.findOne).toHaveBeenCalled();
    });

    it('returns COMPLETED from database and caches it', async () => {
      repo.findOne.mockResolvedValue({
        idempotencyKey,
        resourcePath,
        status: IdempotencyStatus.COMPLETED,
        responseCode: 201,
        responseBody: { foo: 'bar' },
      } as IdempotencyKey);

      const result = await service.checkAndClaim(idempotencyKey, resourcePath);

      expect(result).toEqual({
        status: 'COMPLETED',
        responseCode: 201,
        responseBody: { foo: 'bar' },
      });
      expect(keyValue.setex).toHaveBeenCalledWith(
        redisKey,
        defaultTtl,
        JSON.stringify({
          status: IdempotencyStatus.COMPLETED,
          responseCode: 201,
          responseBody: { foo: 'bar' },
        })
      );
    });

    it('returns IN_PROGRESS when database record is in progress', async () => {
      repo.findOne.mockResolvedValue({
        idempotencyKey,
        resourcePath,
        status: IdempotencyStatus.IN_PROGRESS,
      } as IdempotencyKey);

      const result = await service.checkAndClaim(idempotencyKey, resourcePath);

      expect(result).toEqual({ status: 'IN_PROGRESS' });
      expect(keyValue.setex).not.toHaveBeenCalled();
    });

    it('inserts IN_PROGRESS when no record exists', async () => {
      keyValue.get.mockResolvedValue(null);
      repo.findOne.mockResolvedValue(null);
      repo.insert.mockResolvedValue({} as any);

      const result = await service.checkAndClaim(idempotencyKey, resourcePath);

      expect(result).toEqual({ status: 'NEW' });
      expect(keyValue.setex).toHaveBeenCalledWith(
        redisKey,
        defaultTtl,
        JSON.stringify({
          status: IdempotencyStatus.IN_PROGRESS,
          responseCode: null,
          responseBody: null,
        })
      );
      expect(repo.insert).toHaveBeenCalledWith({
        idempotencyKey,
        resourcePath,
        status: IdempotencyStatus.IN_PROGRESS,
      });
    });

    it('returns IN_PROGRESS when insert hits unique constraint (race condition)', async () => {
      keyValue.get.mockResolvedValue(null);
      repo.findOne.mockResolvedValue(null);
      repo.insert.mockRejectedValue({ code: '23505' });

      const result = await service.checkAndClaim(idempotencyKey, resourcePath);

      expect(result).toEqual({ status: 'IN_PROGRESS' });
    });
  });

  describe('complete', () => {
    it('updates database and caches COMPLETED result', async () => {
      repo.update.mockResolvedValue({} as any);
      keyValue.setex.mockResolvedValue();

      await service.complete(
        idempotencyKey,
        resourcePath,
        200,
        { ok: true },
        undefined
      );

      expect(repo.update).toHaveBeenCalledWith(
        { idempotencyKey, resourcePath },
        {
          status: IdempotencyStatus.COMPLETED,
          responseCode: 200,
          responseBody: { ok: true },
        }
      );
      expect(keyValue.setex).toHaveBeenCalledWith(
        redisKey,
        defaultTtl,
        JSON.stringify({
          status: IdempotencyStatus.COMPLETED,
          responseCode: 200,
          responseBody: { ok: true },
        })
      );
    });
  });

  describe('fail', () => {
    it('deletes record and key-value entry', async () => {
      repo.delete.mockResolvedValue({} as any);
      keyValue.del.mockResolvedValue(true);

      await service.fail(idempotencyKey, resourcePath);

      expect(repo.delete).toHaveBeenCalledWith({
        idempotencyKey,
        resourcePath,
      });
      expect(keyValue.del).toHaveBeenCalledWith(redisKey);
    });
  });
});
