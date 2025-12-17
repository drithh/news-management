import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { validate as isUUID } from 'uuid';
import { Article } from '@/article/article.entity';
import { CreateArticleDto } from '@/article/dto/create-article.dto';
import { QueryArticlesDto } from '@/article/dto/query-articles.dto';
import {
  MESSAGE_QUEUE_PORT,
  MessageQueuePort,
} from '@/message-queue/message-queue.port';

@Injectable()
export class ArticleService {
  constructor(
    @InjectRepository(Article)
    private readonly repo: Repository<Article>,
    @Inject(MESSAGE_QUEUE_PORT)
    private readonly mqService: MessageQueuePort
  ) {}

  async create(dto: CreateArticleDto): Promise<Article> {
    // Check if article with same link already exists
    const existing = await this.repo.findOne({ where: { link: dto.link } });
    if (existing) {
      throw new ConflictException('Article with this link already exists');
    }

    // Create and save article
    const article = this.repo.create(dto);
    await this.repo.save(article);

    // Publish event so other services (e.g. indexer) can react
    await this.mqService.publishArticleCreated({
      id: article.id,
      title: article.title,
      content: article.content,
      source: article.source,
      author: article.author,
      link: article.link,
      createdAt: article.createdAt.toISOString(),
      updatedAt: article.updatedAt.toISOString(),
    });

    return article;
  }

  async findAll(query: QueryArticlesDto): Promise<{
    articles: Article[];
    total: number;
    page: number;
    limit: number;
  }> {
    const whereConditions: FindOptionsWhere<Article> = {};

    if (query.source) {
      whereConditions.source = query.source;
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    const [articles, total] = await this.repo.findAndCount({
      where: whereConditions,
      order: { createdAt: query.sortOrder },
      take: limit,
      skip: offset,
    });

    return { articles, total, page, limit };
  }

  async findOne(id: string): Promise<Article> {
    if (!isUUID(id)) {
      throw new BadRequestException('Invalid UUID');
    }

    const article = await this.repo.findOne({ where: { id } });
    if (!article) {
      throw new NotFoundException('Article not found');
    }

    return article;
  }
}
