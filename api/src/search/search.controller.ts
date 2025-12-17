import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiQuery,
} from '@nestjs/swagger';
import { SearchService } from '@/search/search.service';
import { SearchQueryDto } from '@/search/dto/search-query.dto';
import { SearchResponseDto } from '@/search/dto/search-response.dto';
import { AutocompleteQueryDto } from '@/search/dto/autocomplete-query.dto';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Search articles' })
  @ApiOkResponse({
    description: 'Search results with aggregations',
    type: SearchResponseDto,
  })
  async search(@Query() query: SearchQueryDto): Promise<SearchResponseDto> {
    return this.searchService.search(query);
  }

  @Get('autocomplete')
  @ApiOperation({ summary: 'Get autocomplete suggestions for article titles' })
  @ApiQuery({ name: 'term', description: 'Search term', example: 'break' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Maximum number of suggestions',
    type: Number,
  })
  @ApiOkResponse({
    description: 'Array of autocomplete suggestions (article titles)',
    type: [String],
  })
  async autocomplete(@Query() query: AutocompleteQueryDto): Promise<string[]> {
    return this.searchService.autocomplete(query.term, query.limit);
  }
}
