import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Article } from '@/article/article.entity';
import {
  MESSAGE_QUEUE_PORT,
  MessageQueuePort,
} from '@/message-queue/message-queue.port';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let articleRepo: any;

  const mockMqService: MessageQueuePort = {
    publishArticleJob: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MESSAGE_QUEUE_PORT)
      .useValue(mockMqService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true })
    );
    app.setGlobalPrefix('api');

    articleRepo = moduleFixture.get(getRepositoryToken(Article));

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up database before each test
    await articleRepo.delete({});
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
