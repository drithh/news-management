import { ApiProperty } from '@nestjs/swagger';

class SearchArticleItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  source: string;

  @ApiProperty()
  link: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

class SourceAggregationBucketDto {
  @ApiProperty()
  key: string;

  @ApiProperty()
  docCount: number;
}

class AggregationsDto {
  @ApiProperty({ type: [SourceAggregationBucketDto] })
  sources: SourceAggregationBucketDto[];
}

export class SearchResponseDto {
  @ApiProperty({ type: [SearchArticleItemDto] })
  data: SearchArticleItemDto[];

  @ApiProperty()
  total: number;

  @ApiProperty({ type: AggregationsDto })
  aggregations: AggregationsDto;

  @ApiProperty({ required: false })
  took?: number;
}
