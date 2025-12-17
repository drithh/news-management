import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';
import { SearchQueryDto } from '@/search/dto/search-query.dto';
import { SearchResponseDto } from '@/search/dto/search-response.dto';

interface MultiMatchQuery {
  multi_match: {
    query: string;
    fields: string[];
  };
}

interface MatchAllQuery {
  match_all: Record<string, never>;
}

interface TermQuery {
  term: Record<string, string>;
}

interface RangeQuery {
  range: Record<string, Record<string, string>>;
}

type QueryClause = MultiMatchQuery | MatchAllQuery | TermQuery | RangeQuery;

interface BoolQuery {
  bool: {
    must: QueryClause[];
    filter: QueryClause[];
  };
}

interface SortClause {
  [field: string]:
    | {
        order: 'asc' | 'desc';
      }
    | 'asc'
    | 'desc';
}

interface SearchRequestBody {
  query: BoolQuery;
  from: number;
  size: number;
  aggs?: {
    sources: {
      terms: {
        field: string;
      };
    };
  };
  sort?: SortClause[];
}

interface ArticleSource {
  id: string;
  title: string;
  content: string;
  source: string;
  link: string;
  created_at: string;
  updated_at: string;
}

interface SearchHit {
  _source: ArticleSource;
}

interface SearchHits {
  total: number | { value: number };
  hits: SearchHit[];
}

interface AggregationBucket {
  key: string;
  doc_count: number;
}

interface SourcesAggregation {
  sources: {
    buckets: AggregationBucket[];
  };
}

interface ElasticsearchSearchResponse {
  hits: SearchHits;
  aggregations?: SourcesAggregation;
  took: number;
}

@Injectable()
export class SearchService {
  private readonly client: Client;
  private readonly logger = new Logger(SearchService.name);
  private readonly INDEX_NAME = 'articles';

  constructor(private readonly configService: ConfigService) {
    this.client = new Client({
      node: this.configService.get(
        'ELASTICSEARCH_URL',
        'http://localhost:9200'
      ),
    });
  }

  async search(query: SearchQueryDto): Promise<SearchResponseDto> {
    const {
      q,
      source,
      from,
      to,
      limit = 20,
      offset = 0,
      sortBy = 'relevance',
      sortOrder = 'DESC',
    } = query;

    const must: QueryClause[] = [];
    const filter: QueryClause[] = [];

    if (q) {
      must.push({
        multi_match: {
          query: q,
          fields: ['title', 'content'],
        },
      });
    }

    if (source) {
      filter.push({ term: { 'source.keyword': source } });
    }

    if (from || to) {
      const range: Record<string, string> = {};
      if (from) range.gte = from.toISOString();
      if (to) range.lte = to.toISOString();
      filter.push({ range: { created_at: range } });
    }

    const sort: SortClause[] = [];
    if (sortBy === 'date') {
      const order = sortOrder === 'ASC' ? 'desc' : 'asc';
      sort.push({
        created_at: { order },
      });
    }

    const body: SearchRequestBody = {
      query: {
        bool: {
          must: must.length ? must : [{ match_all: {} }],
          filter,
        },
      },
      from: offset,
      size: limit,
      aggs: {
        sources: {
          terms: { field: 'source.keyword' },
        },
      },
    };

    if (sort.length) {
      body.sort = sort;
    }

    const searchParams = {
      index: this.INDEX_NAME,
      query: body.query,
      from: body.from,
      size: body.size,
      aggs: body.aggs,
      ...(body.sort ? { sort: body.sort } : {}),
    };
    const result = await this.client.search<ArticleSource>(
      searchParams as unknown as Parameters<Client['search']>[0]
    );

    const response = result as unknown as ElasticsearchSearchResponse;
    const hits = response.hits.hits ?? [];
    const total =
      typeof response.hits.total === 'number'
        ? response.hits.total
        : (response.hits.total?.value ?? 0);

    const articles = hits.map((hit) => {
      const src = hit._source;
      return {
        id: src.id,
        title: src.title,
        content: src.content,
        source: src.source,
        link: src.link,
        createdAt: src.created_at,
        updatedAt: src.updated_at,
      };
    });

    const aggregations = response.aggregations ?? { sources: { buckets: [] } };
    const sourcesAgg = aggregations.sources?.buckets ?? [];

    return {
      data: articles,
      total,
      aggregations: {
        sources: sourcesAgg.map((b) => ({
          key: b.key,
          docCount: b.doc_count,
        })),
      },
      took: response.took,
    };
  }

  async autocomplete(term: string, limit = 10): Promise<string[]> {
    interface AutocompleteRequestBody {
      query: {
        bool: {
          should: Array<{
            multi_match?: {
              query: string;
              type: string;
              fields: string[];
            };
            match_phrase_prefix?: {
              [field: string]: {
                query: string;
                max_expansions: number;
              };
            };
          }>;
          minimum_should_match: number;
        };
      };
      size: number;
      _source: string[];
    }

    interface AutocompleteSource {
      title: string;
    }

    // Try title.autocomplete first (if search_as_you_type field exists), fallback to title prefix match
    const body: AutocompleteRequestBody = {
      query: {
        bool: {
          should: [
            {
              multi_match: {
                query: term,
                type: 'bool_prefix',
                fields: [
                  'title.autocomplete',
                  'title.autocomplete._2gram',
                  'title.autocomplete._3gram',
                ],
              },
            },
            {
              match_phrase_prefix: {
                title: {
                  query: term,
                  max_expansions: limit * 2,
                },
              },
            },
          ],
          minimum_should_match: 1,
        },
      },
      size: limit,
      _source: ['title'],
    };

    const searchParams = {
      index: this.INDEX_NAME,
      query: body.query,
      size: body.size,
      _source: body._source,
    };
    const result = await this.client.search<AutocompleteSource>(
      searchParams as unknown as Parameters<Client['search']>[0]
    );

    const response = result as unknown as ElasticsearchSearchResponse;
    const hits = response.hits.hits ?? [];
    const titles = hits
      .map((hit) => (hit._source as AutocompleteSource)?.title)
      .filter((title): title is string => Boolean(title));

    // De-duplicate while preserving order
    return Array.from(new Set(titles));
  }
}
