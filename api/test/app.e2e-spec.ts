import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Article } from '@/article/article.entity';
import { MESSAGE_QUEUE_PORT } from '@/message-queue/message-queue.port';
import { KEY_VALUE_PORT, KeyValuePort } from '@/key-value/key-value.port';
import { REDIS_CLIENT } from '@/redis/redis.module';
import { IdempotencyKey } from '@/idempotency/idempotency-key.entity';
import { Repository } from 'typeorm';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let articleRepo: Repository<Article>;
  let idempotencyRepo: Repository<IdempotencyKey>;

  const mockMqService = {
    publish: jest.fn().mockResolvedValue(undefined),
    publishArticleCreated: jest.fn().mockResolvedValue(undefined),
  };

  const mockRedisClient = {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    setnx: jest.fn(),
    ttl: jest.fn(),
    expire: jest.fn(),
    on: jest.fn(),
    quit: jest.fn(),
  };

  const store = new Map<string, { value: string; expiresAt?: number }>();
  const inMemoryKeyValue: KeyValuePort = {
    async get(key: string) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key: string, value: string) {
      store.set(key, { value });
    },
    async setex(key: string, ttl: number, value: string) {
      store.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
    },
    async del(key: string) {
      return store.delete(key);
    },
    async exists(key: string) {
      return store.has(key);
    },
    async setnx(key: string, value: string) {
      if (store.has(key)) return false;
      store.set(key, { value });
      return true;
    },
    async ttl(key: string) {
      const entry = store.get(key);
      if (!entry) return -2;
      if (!entry.expiresAt) return -1;
      return Math.max(0, Math.floor((entry.expiresAt - Date.now()) / 1000));
    },
    async expire(key: string, ttl: number) {
      const entry = store.get(key);
      if (!entry) return false;
      entry.expiresAt = Date.now() + ttl * 1000;
      store.set(key, entry);
      return true;
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MESSAGE_QUEUE_PORT)
      .useValue(mockMqService)
      .overrideProvider(REDIS_CLIENT)
      .useValue(mockRedisClient)
      .overrideProvider(KEY_VALUE_PORT)
      .useValue(inMemoryKeyValue)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true })
    );
    app.setGlobalPrefix('api');

    articleRepo = moduleFixture.get(getRepositoryToken(Article));
    idempotencyRepo = moduleFixture.get(getRepositoryToken(IdempotencyKey));

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up database and in-memory cache before each test
    await articleRepo.createQueryBuilder().delete().from(Article).execute();
    await idempotencyRepo
      .createQueryBuilder()
      .delete()
      .from(IdempotencyKey)
      .execute();
    store.clear();
    jest.clearAllMocks();
  });

  describe('/api/health (GET)', () => {
    it('should return health status', () => {
      return request(app.getHttpServer())
        .get('/api/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('ok');
          expect(res.body.timestamp).toBeDefined();
        });
    });
  });

  describe('/api/articles (POST)', () => {
    it('should create article', () => {
      const createDto = {
        title: 'Test Article',
        content: 'Test content',
        source: 'test-source',
        link: 'https://example.com/test',
      };

      return request(app.getHttpServer())
        .post('/api/articles')
        .send(createDto)
        .expect(201)
        .expect((res) => {
          expect(res.body.id).toBeDefined();
          expect(res.body.title).toBe(createDto.title);
          expect(res.body.createdAt).toBeDefined();
        });
    });

    it('should return 409 for duplicate link', async () => {
      const createDto = {
        title: 'Test',
        content: 'Content',
        source: 'source',
        link: 'https://example.com/duplicate',
      };

      await request(app.getHttpServer())
        .post('/api/articles')
        .send(createDto)
        .expect(201);

      return request(app.getHttpServer())
        .post('/api/articles')
        .send(createDto)
        .expect(409);
    });

    it('should return cached response for same Idempotency-Key', async () => {
      const createDto = {
        title: 'Idem Title',
        content: 'Idem Content',
        source: 'source',
        link: 'https://example.com/idempotent',
      };
      const redisKey = 'idempotency:POST:/api/articles:idem-key-1';

      const first = await request(app.getHttpServer())
        .post('/api/articles')
        .set('Idempotency-Key', 'idem-key-1')
        .send(createDto)
        .expect(201);

      // Wait until interceptor caches the completed response
      const waitForCached = async () => {
        for (let i = 0; i < 5; i++) {
          const raw = await inMemoryKeyValue.get(redisKey);
          if (raw) {
            const data = JSON.parse(raw);
            if (data.status === 'COMPLETED') return data;
          }
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        return null;
      };

      const cached = await waitForCached();
      expect(cached?.status).toBe('COMPLETED');

      const second = await request(app.getHttpServer())
        .post('/api/articles')
        .set('Idempotency-Key', 'idem-key-1')
        .send(createDto)
        .expect(201);

      expect(first.body.id).toBeDefined();
      expect(second.body).toEqual(first.body);
      expect(mockMqService.publishArticleCreated).toHaveBeenCalledTimes(1);
    });

    it('should return 409 when idempotency key is in progress', async () => {
      const createDto = {
        title: 'Race',
        content: 'Race content',
        source: 'source',
        link: 'https://example.com/race',
      };

      const resourcePath = 'POST:/api/articles';
      store.set(`idempotency:${resourcePath}:race-key`, {
        value: JSON.stringify({ status: 'IN_PROGRESS' }),
      });

      await request(app.getHttpServer())
        .post('/api/articles')
        .set('Idempotency-Key', 'race-key')
        .send(createDto)
        .expect(409);
    });
  });

  describe('/api/articles (GET)', () => {
    it('should return list of articles', async () => {
      // Seed data
      await articleRepo.save([
        {
          title: 'Article 1',
          content: 'Content 1',
          source: 'source1',
          link: 'https://example.com/1',
        },
        {
          title: 'Article 2',
          content: 'Content 2',
          source: 'source2',
          link: 'https://example.com/2',
        },
      ]);

      return request(app.getHttpServer())
        .get('/api/articles')
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(2);
          expect(res.body.total).toBe(2);
        });
    });
  });
});
