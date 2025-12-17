import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsUrl,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateArticleDto {
  @ApiProperty({
    description: 'Title of the article',
    maxLength: 500,
    example: 'Breaking News: API Design in Practice',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(500)
  title: string;

  @ApiProperty({
    description: 'Full textual content of the article',
    example: 'In today’s news, we explore how to build a robust news API...',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  content: string;

  @ApiProperty({
    description: 'Source of the article (e.g. twitter, google, rss)',
    maxLength: 200,
    example: 'twitter',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(200)
  source: string;

  @ApiProperty({
    description: 'Author of the article',
    maxLength: 200,
    example: 'John Doe',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(200)
  author: string;

  @ApiProperty({
    description: 'Canonical URL of the article',
    example: 'https://example.com/articles/123',
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  link: string;
}
