import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ArticleService } from '@/article/article.service';
import { Article } from '@/article/article.entity';
import { CreateArticleDto } from '@/article/dto/create-article.dto';
import {
  MESSAGE_QUEUE_PORT,
  MessageQueuePort,
} from '@/message-queue/message-queue.port';

describe('ArticleService', () => {
  let service: ArticleService;
  let repo: Repository<Article>;
  let mqService: MessageQueuePort;

  const mockArticle: Article = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    title: 'Test Article',
    content: 'Test content',
    source: 'test-source',
    link: 'https://example.com/test',
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleService,
        {
          provide: getRepositoryToken(Article),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            findAndCount: jest.fn(),
          },
        },
        {
          provide: MESSAGE_QUEUE_PORT,
          useValue: {
            publish: jest.fn(),
            publishArticleCreated: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ArticleService>(ArticleService);
    repo = module.get<Repository<Article>>(getRepositoryToken(Article));
    mqService = module.get<MessageQueuePort>(MESSAGE_QUEUE_PORT);
  });

  describe('create', () => {
    const dto: CreateArticleDto = {
      title: 'Test',
      content: 'Content',
      source: 'source',
      link: 'https://example.com/test',
    };

    it('should create article and publish job', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);
      jest.spyOn(repo, 'create').mockReturnValue(mockArticle);
      jest.spyOn(repo, 'save').mockResolvedValue(mockArticle);
      jest.spyOn(mqService, 'publishArticleCreated').mockResolvedValue();

      const result = await service.create(dto);

      expect(result).toEqual(mockArticle);
      expect(mqService.publishArticleCreated).toHaveBeenCalledWith({
        id: mockArticle.id,
        title: mockArticle.title,
        content: mockArticle.content,
        source: mockArticle.source,
        link: mockArticle.link,
        createdAt: mockArticle.createdAt.toISOString(),
        updatedAt: mockArticle.updatedAt.toISOString(),
      });
    });

    it('should throw ConflictException if link exists', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(mockArticle);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return paginated articles', async () => {
      jest.spyOn(repo, 'findAndCount').mockResolvedValue([[mockArticle], 1]);

      const result = await service.findAll({
        limit: 10,
        offset: 0,
        sortOrder: 'DESC',
      });

      expect(result.articles).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return article by id', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(mockArticle);

      const result = await service.findOne(mockArticle.id);

      expect(result).toEqual(mockArticle);
    });

    it('should throw NotFoundException if not found', async () => {
      jest.spyOn(repo, 'findOne').mockResolvedValue(null);

      await expect(
        service.findOne('550e8400-e29b-41d4-a716-446655440000')
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for invalid UUID', async () => {
      await expect(service.findOne('invalid-uuid')).rejects.toThrow(
        BadRequestException
      );
    });
  });
});
