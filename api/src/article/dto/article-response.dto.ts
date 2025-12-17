import { ApiProperty } from '@nestjs/swagger';
import { Article } from '@/article/article.entity';

export class ArticleResponseDto {
  constructor(article: Article) {
    this.id = article.id;
    this.title = article.title;
    this.content = article.content;
    this.source = article.source;
    this.author = article.author;
    this.link = article.link;
    this.createdAt = article.createdAt.toISOString();
    this.updatedAt = article.updatedAt.toISOString();
  }

  @ApiProperty({
    description: 'Unique identifier of the article',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({ description: 'Title of the article' })
  title: string;

  @ApiProperty({ description: 'Content of the article' })
  content: string;

  @ApiProperty({ description: 'Source of the article' })
  source: string;

  @ApiProperty({ description: 'Author of the article' })
  author: string;

  @ApiProperty({ description: 'Canonical URL of the article' })
  link: string;

  @ApiProperty({
    description: 'Creation timestamp in ISO 8601 format',
    example: '2025-01-01T12:00:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Last update timestamp in ISO 8601 format',
    example: '2025-01-01T12:05:00.000Z',
  })
  updatedAt: string;
}
