import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiHeader,
  ApiBadRequestResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { ArticleService } from '@/article/article.service';
import { CreateArticleDto } from '@/article/dto/create-article.dto';
import { ArticleResponseDto } from '@/article/dto/article-response.dto';
import { QueryArticlesDto } from '@/article/dto/query-articles.dto';
import { PaginatedArticleResponseDto } from '@/article/dto/paginated-article-response.dto';
import { CreateArticleResponseDto } from '@/article/dto/create-article-response.dto';
import { ErrorResponseDto } from '@/article/dto/error-response.dto';
import { Idempotent } from '@/idempotency/idempotent.decorator';

@ApiTags('articles')
@Controller('articles')
export class ArticleController {
  constructor(private readonly service: ArticleService) {}

  @Post()
  @Idempotent({ ttl: 86400 }) // 24 hours
  @ApiOperation({ summary: 'Create a new article' })
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({
    description: 'Article created successfully',
    type: CreateArticleResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Validation error',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'Article with this link already exists',
    type: ErrorResponseDto,
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'Unique key to ensure idempotent request processing',
    required: false,
    schema: { type: 'string' },
  })
  async create(
    @Body() dto: CreateArticleDto
  ): Promise<CreateArticleResponseDto> {
    const article = await this.service.create(dto);
    return {
      status: 'ok',
      message: 'News stored and queued',
      id: article.id,
    };
  }

  @Get()
  @ApiOperation({ summary: 'List articles' })
  @ApiOkResponse({
    description: 'Paginated list of articles',
    type: PaginatedArticleResponseDto,
  })
  async findAll(
    @Query() query: QueryArticlesDto
  ): Promise<PaginatedArticleResponseDto> {
    const { articles, total, page, limit } = await this.service.findAll(query);
    return {
      data: articles.map((article) => new ArticleResponseDto(article)),
      page,
      limit,
      total,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single article by ID' })
  @ApiOkResponse({
    description: 'Article retrieved successfully',
    type: ArticleResponseDto,
  })
  async findOne(@Param('id') id: string): Promise<ArticleResponseDto> {
    const article = await this.service.findOne(id);
    return new ArticleResponseDto(article);
  }
}
