import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SearchService } from '@/search/search.service';
import { SearchQueryDto } from '@/search/dto/search-query.dto';

const mockClient = {
  search: jest.fn(),
};

jest.mock('@elastic/elasticsearch', () => {
  return {
    Client: jest.fn(() => mockClient),
  };
});

describe('SearchService', () => {
  let service: SearchService;
  let configService: ConfigService;

  beforeEach(async () => {
    mockClient.search.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('http://localhost:9200'),
          },
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(configService).toBeDefined();
  });

  it('should perform search and map results', async () => {
    const query: SearchQueryDto = { q: 'test', limit: 10, offset: 0 };

    mockClient.search.mockResolvedValue({
      hits: {
        total: { value: 1 },
        hits: [
          {
            _source: {
              id: '1',
              title: 'Test',
              content: 'Content',
              source: 'twitter',
              link: 'https://example.com',
              created_at: '2025-01-01T00:00:00.000Z',
              updated_at: '2025-01-01T00:00:00.000Z',
            },
          },
        ],
      },
      aggregations: {
        sources: {
          buckets: [{ key: 'twitter', doc_count: 1 }],
        },
      },
      took: 5,
    });

    const result = await service.search(query);

    expect(mockClient.search).toHaveBeenCalled();
    expect(result.total).toBe(1);
    expect(result.data[0].title).toBe('Test');
    expect(result.aggregations.sources[0]).toEqual({
      key: 'twitter',
      docCount: 1,
    });
    expect(result.took).toBe(5);
  });

  it('should perform autocomplete and return unique titles', async () => {
    mockClient.search.mockResolvedValue({
      hits: {
        hits: [
          { _source: { title: 'Tes' } },
          { _source: { title: 'Test' } },
          { _source: { title: 'Test' } },
        ],
      },
    });

    const result = await service.autocomplete('te');

    expect(mockClient.search).toHaveBeenCalled();
    expect(result).toEqual(['Tes', 'Test']);
  });
});

