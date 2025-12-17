# News Worker

Python background worker for indexing news articles in Elasticsearch.

## Features

- Consumes messages from RabbitMQ
- Indexes articles in Elasticsearch
- Idempotency handling to prevent duplicate processing
- Retry logic with exponential backoff
- Error handling and logging

## Architecture

The worker is built with Python and uses:

- **RabbitMQ** - Message queue to receive article indexing requests
- **PostgreSQL** - Database to fetch article data and check idempotency
- **Elasticsearch** - Search engine where articles are indexed

### How It Works

1. Listens for `news.created` events from RabbitMQ
2. Validates and processes article data
3. Checks idempotency to prevent duplicate indexing
4. Indexes articles in Elasticsearch
5. Handles errors with retry logic

## How to Clone and Run

### Using Docker Compose (Recommended)

From the project root:

```bash
docker-compose up -d worker
```

This will start the worker along with all required services.

### Using Docker

```bash
docker build -t news-worker .
docker run --env-file .env news-worker
```

### Local Development

1. **Install dependencies**

```bash
poetry install
```

2. **Set up environment variables**

Copy `.env.example` to `.env` and configure:

```env
POSTGRES_URL=postgresql://news:news@localhost:5432/news
RABBITMQ_URL=amqp://guest:guest@localhost:5672
ELASTICSEARCH_URL=http://localhost:9200
LOG_LEVEL=INFO
```

3. **Run the worker**

```bash
poetry run news-worker
```

## Environment Configuration

### Required Environment Variables

- `POSTGRES_URL` - PostgreSQL connection string

  - Format: `postgresql://user:password@host:port/database`
  - Example: `postgresql://news:news@localhost:5432/news`

- `RABBITMQ_URL` - RabbitMQ connection string

  - Format: `amqp://user:password@host:port`
  - Example: `amqp://guest:guest@localhost:5672`

- `ELASTICSEARCH_URL` - Elasticsearch URL

  - Default: `http://localhost:9200`

- `LOG_LEVEL` - Logging level
  - Options: `DEBUG`, `INFO`, `WARNING`, `ERROR`
  - Default: `INFO`

### Environment File Setup

1. Copy the example file:

```bash
cp .env.example .env
```

2. Update the values according to your setup

## How to Test the Worker

### 1. Check Worker Logs

```bash
# Using Docker Compose
docker-compose logs -f worker

# Or if running locally, logs will appear in the terminal
```

The worker will show logs when processing messages from RabbitMQ.

### 2. Create Article via API

When you create an article through the API, the worker will automatically receive a message and index it to Elasticsearch.

```bash
# Create an article
curl -X POST http://localhost:3000/api/articles \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Article",
    "content": "Test content for worker processing",
    "source": "Test Source",
    "link": "https://example.com/test"
  }'
```

### 3. Verify in Elasticsearch

Check if the article was indexed:

```bash
# Search all documents
curl http://localhost:9200/news/_search?q=*&pretty

# Search by specific term
curl "http://localhost:9200/news/_search?q=title:Test&pretty"
```

### 4. Verify in Kibana

1. Open http://localhost:5601 in your browser
2. Go to Stack Management > Index Patterns
3. Create an index pattern for `news`
4. Go to Discover to view indexed articles
5. Search for the article you created

### 5. Check RabbitMQ Queue

1. Open http://localhost:15672 in your browser (guest/guest)
2. Navigate to the "Queues" tab
3. Check the `news.created` queue to see messages being processed
4. Monitor message consumption and processing

### 6. Test Idempotency

Create the same article twice with the same link:

```bash
# First request
curl -X POST http://localhost:3000/api/articles \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Duplicate Test",
    "content": "Content",
    "source": "Source",
    "link": "https://example.com/duplicate"
  }'

# Second request (should be rejected by API, but if it goes through, worker should handle idempotency)
curl -X POST http://localhost:3000/api/articles \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Duplicate Test",
    "content": "Content",
    "source": "Source",
    "link": "https://example.com/duplicate"
  }'
```

The worker should prevent duplicate indexing even if the message is processed multiple times.

### 7. Monitor Worker Health

Check if the worker is running and processing messages:

```bash
# Check container status
docker-compose ps worker

# Check recent logs
docker-compose logs --tail=50 worker

# Follow logs in real-time
docker-compose logs -f worker
```

## Troubleshooting

### Worker not processing messages

1. **Check RabbitMQ connection**:

   ```bash
   docker-compose logs rabbitmq
   ```

   Verify the worker can connect to RabbitMQ.

2. **Check Elasticsearch connection**:

   ```bash
   curl http://localhost:9200/_cluster/health
   ```

   Ensure Elasticsearch is healthy.

3. **Check PostgreSQL connection**:

   ```bash
   docker-compose logs postgres
   ```

   Verify database connectivity.

4. **Check worker logs**:
   ```bash
   docker-compose logs worker
   ```
   Look for error messages.

### Messages stuck in queue

1. Check if worker is running: `docker-compose ps worker`
2. Restart the worker: `docker-compose restart worker`
3. Check for errors in logs: `docker-compose logs worker`

### Elasticsearch indexing errors

1. Verify Elasticsearch is running: `curl http://localhost:9200`
2. Check Elasticsearch logs: `docker-compose logs elasticsearch`
3. Verify index exists: `curl http://localhost:9200/_cat/indices`

### Connection timeout errors

- Ensure all services are healthy: `docker-compose ps`
- Check service URLs in `.env` file
- Verify network connectivity between containers
