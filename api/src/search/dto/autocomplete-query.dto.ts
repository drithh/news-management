import { IsString, IsInt, Min, Max, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AutocompleteQueryDto {
  @ApiProperty({
    description: 'Search term for autocomplete suggestions',
    example: 'break',
  })
  @IsString()
  term: string;

  @ApiPropertyOptional({
    description: 'Maximum number of suggestions to return',
    minimum: 1,
    maximum: 50,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
