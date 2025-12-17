# News Management System

A news management system with API and background worker services.

## Architecture Overview

This system uses a microservices architecture with the following components:

- **API** - NestJS REST API for managing news articles and search
- **Worker** - Python background worker for indexing articles in Elasticsearch

### Workflow

1. API receives request to create a new article
2. Article is saved to PostgreSQL
3. API sends message to RabbitMQ for indexing
4. Worker consumes message from RabbitMQ
5. Worker indexes article to Elasticsearch for search
6. Redis is used for caching and idempotency

### Services

- **PostgreSQL** - Database for storing articles
- **Redis** - Caching and idempotency
- **RabbitMQ** - Message queue for async communication between API and Worker
- **Elasticsearch** - Search engine for full-text search
- **Kibana** - UI for Elasticsearch

## How to Clone and Run the Project

### Prerequisites

- Docker and Docker Compose installed
- Git installed

### Steps

1. **Clone the repository**

```bash
git clone https://github.com/drithh/news-management.git
cd news-management
```

2. **Run with Docker Compose**

```bash
docker-compose up -d
```

This will:

- Build images for API and Worker
- Start all services (PostgreSQL, Redis, RabbitMQ, Elasticsearch, Kibana)
- Run API on port 3000
- Run Worker automatically

3. **Check service status**

```bash
docker-compose ps
```

### Service Access

- **API**: http://localhost:3000/api
- **Swagger Docs**: http://localhost:3000/api/docs
- **RabbitMQ Management**: http://localhost:15672 (guest/guest)
- **Kibana**: http://localhost:5601
- **Elasticsearch**: http://localhost:9200

## API Testing with Postman

A Postman collection is included for easy API testing and exploration.

### Importing the Collection

1. **Open Postman** (Desktop app or web version)

2. **Import the collection**:

   - Click "Import" button
   - Select the file: `News Management API.postman_collection.json`
   - Or drag and drop the file into Postman

3. **Configure the base URL** (if needed):
   - The collection uses a `baseUrl` variable set to `http://localhost:3000`
   - If your API runs on a different port, update the variable in the collection settings

### Using the Collection

- All requests include example request bodies and expected responses
- The "Create a new article" endpoint includes an `Idempotency-Key` header example
- Search endpoints include example query parameters
- Variables are pre-configured for easy environment switching

## Testing Idempotency

The system implements idempotency at two levels to prevent duplicate processing:

### API-Level Idempotency

The API uses the `Idempotency-Key` header to prevent duplicate article creation:

- **Storage**: Redis (fast cache) + PostgreSQL (source of truth)
- **TTL**: 24 hours (configurable)
- **Behavior**:
  - First request with a key: processes normally and caches the response
  - Subsequent requests with the same key: returns cached response without processing
  - Concurrent requests with the same key: returns 409 Conflict if one is in progress

### Worker-Level Idempotency

The worker uses `event_id` from RabbitMQ messages to prevent duplicate indexing:

- **Storage**: PostgreSQL `idempotency_keys` table
- **Behavior**:
  - Checks if `event_id` was already processed (COMPLETED)
  - If IN_PROGRESS, requeues the message (another worker is handling it)
  - If NEW, claims the event, processes it, then marks it COMPLETED
  - Ensures each article is indexed exactly once, even with multiple workers

### Testing Idempotency

Test both API and worker idempotency by creating the same article twice:

```bash
# First request - creates article and queues for indexing
curl -X POST http://localhost:3000/api/articles \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-idempotency-123" \
  -d '{
    "title": "Idempotency Test",
    "content": "Testing duplicate prevention",
    "source": "Test Source",
    "author": "Test Author",
    "link": "https://example.com/idempotency-test"
  }'

# Second request with same idempotency key - should return cached response
curl -X POST http://localhost:3000/api/articles \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-idempotency-123" \
  -d '{
    "title": "Idempotency Test",
    "content": "Testing duplicate prevention",
    "source": "Test Source",
    "author": "Test Author",
    "link": "https://example.com/idempotency-test"
  }'
```

**Expected Results**:

1. **API Response**:

   - First request: Returns 201 Created with article ID
   - Second request: Returns 201 Created with the **same** article ID (cached response)
   - No duplicate article is created in the database
   - Only one message is sent to RabbitMQ

2. **Worker Behavior**:
   - If a duplicate message somehow reaches the worker (e.g., RabbitMQ retries), it checks the `event_id`
   - If already `COMPLETED`, the worker skips processing and logs: "Event {event_id} already processed; skipping"
   - If multiple workers try to process the same message, only one will succeed and the others will be requeued.


## Environment Configuration

When using Docker Compose, environment variables are automatically configured. For local development, see the README files in `api/` and `worker/` directories for detailed environment setup.

## Testing

For detailed testing instructions:

- **API Testing**: See [api/README.md](api/README.md)

## Development

For detailed development setup:

- **API Development**: See [api/README.md](api/README.md)
- **Worker Development**: See [worker/README.md](worker/README.md)
