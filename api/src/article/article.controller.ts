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
} from '@nestjs/swagger';
import { ArticleService } from '@/article/article.service';
import { CreateArticleDto } from '@/article/dto/create-article.dto';
import { ArticleResponseDto } from '@/article/dto/article-response.dto';
import { QueryArticlesDto } from '@/article/dto/query-articles.dto';

@ApiTags('articles')
@Controller('articles')
export class ArticleController {
  constructor(private readonly service: ArticleService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new article' })
  @HttpCode(HttpStatus.CREATED)
  @ApiCreatedResponse({
    description: 'Article created successfully',
    type: ArticleResponseDto,
  })
  async create(@Body() dto: CreateArticleDto): Promise<ArticleResponseDto> {
    const article = await this.service.create(dto);
    return new ArticleResponseDto(article);
  }

  @Get()
  @ApiOperation({ summary: 'List articles from PostgreSQL' })
  @ApiOkResponse({
    description: 'List of articles with total count',
    type: ArticleResponseDto,
    isArray: true,
  })
  @ApiQuery({ name: 'source', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: ['ASC', 'DESC'],
  })
  async findAll(
    @Query() query: QueryArticlesDto
  ): Promise<{ data: ArticleResponseDto[]; total: number }> {
    const { articles, total } = await this.service.findAll(query);
    return {
      data: articles.map((article) => new ArticleResponseDto(article)),
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
