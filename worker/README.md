# News Worker

Python background worker for indexing news articles in Elasticsearch.

## Features

- Consumes messages from RabbitMQ
- Indexes articles in Elasticsearch
- Idempotency handling
- Retry logic with exponential backoff

## Quick Start

### Using Docker

```bash
docker build -t news-worker .
docker run --env-file .env news-worker
```

### Local Development

```bash
poetry install
poetry run news-worker
```

## Environment Variables

- `POSTGRES_URL` - PostgreSQL connection string
- `RABBITMQ_URL` - RabbitMQ connection string
- `ELASTICSEARCH_URL` - Elasticsearch URL (default: http://localhost:9200)
- `LOG_LEVEL` - Logging level (default: INFO)

## How It Works

1. Listens for `news.created` events from RabbitMQ
2. Validates and processes article data
3. Indexes articles in Elasticsearch
4. Handles idempotency to prevent duplicate processing
