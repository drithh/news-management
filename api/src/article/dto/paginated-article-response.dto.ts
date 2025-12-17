import { ApiProperty } from '@nestjs/swagger';
import { ArticleResponseDto } from './article-response.dto';

export class PaginatedArticleResponseDto {
  @ApiProperty({
    type: [ArticleResponseDto],
    description: 'Array of articles',
  })
  data: ArticleResponseDto[];

  @ApiProperty({
    description: 'Current page number (1-indexed)',
    example: 1,
    minimum: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10,
    minimum: 1,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of items available',
    example: 100,
    minimum: 0,
  })
  total: number;
}
