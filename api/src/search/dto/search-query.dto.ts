import { IsOptional, IsString, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SearchQueryDto {
  @ApiPropertyOptional({
    description: 'Full-text search query',
    example: 'breaking news',
  })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({
    description: 'Filter by article source',
    example: 'twitter',
  })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({
    description: 'Start date (ISO 8601)',
    example: '2025-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @Type(() => Date)
  from?: Date;

  @ApiPropertyOptional({
    description: 'End date (ISO 8601)',
    example: '2025-01-31T23:59:59.999Z',
  })
  @IsOptional()
  @Type(() => Date)
  to?: Date;

  @ApiPropertyOptional({
    description: 'Maximum number of articles to return',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Number of articles to skip (for pagination)',
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({
    description: 'Sort by relevance (default) or creation date',
    enum: ['relevance', 'date'],
    default: 'relevance',
  })
  @IsOptional()
  @IsEnum(['relevance', 'date'])
  sortBy?: 'relevance' | 'date' = 'relevance';

  @ApiPropertyOptional({
    description: 'Sort order for creation date when sortBy=date',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
  })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
