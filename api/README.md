# News API

NestJS REST API for managing news articles and search.

## Features

- Article CRUD operations
- Full-text search with Elasticsearch
- Autocomplete suggestions
- Idempotency support
- Health checks

## Architecture

The API is built with NestJS and uses:

- **PostgreSQL** - Primary database for articles
- **Elasticsearch** - Search engine for full-text search
- **Redis** - Caching and idempotency key storage
- **RabbitMQ** - Message queue for async article indexing

## How to Clone and Run

### Using Docker Compose (Recommended)

From the project root:

```bash
docker-compose up -d api
```

This will start the API along with all required services.

### Using Docker

```bash
docker build -t news-api .
docker run -p 3000:3000 --env-file .env news-api
```

### Local Development

1. **Install dependencies**

```bash
npm install
```

2. **Set up environment variables**

Copy `.env.example` to `.env` and configure:

```env
NODE_ENV=development
PORT=3000
POSTGRES_URL=postgresql://news:news@localhost:5432/news
ELASTICSEARCH_URL=http://localhost:9200
REDIS_HOST=localhost
REDIS_PORT=6379
RABBITMQ_URL=amqp://guest:guest@localhost:5672
```

3. **Start the API**

```bash
npm run start:dev
```

The API will be available at http://localhost:3000/api

## Environment Configuration

### Required Environment Variables

- `POSTGRES_URL` - PostgreSQL connection string
  - Format: `postgresql://user:password@host:port/database`
  - Example: `postgresql://news:news@localhost:5432/news`

- `ELASTICSEARCH_URL` - Elasticsearch URL
  - Default: `http://localhost:9200`

- `REDIS_HOST` - Redis host
  - Default: `localhost`

- `REDIS_PORT` - Redis port
  - Default: `6379`

- `RABBITMQ_URL` - RabbitMQ connection string
  - Format: `amqp://user:password@host:port`
  - Example: `amqp://guest:guest@localhost:5672`

- `PORT` - Server port
  - Default: `3000`

- `NODE_ENV` - Environment mode
  - Options: `development`, `production`

### Environment File Setup

1. Copy the example file:

```bash
cp .env.example .env
```

2. Update the values according to your setup

## Database Migrations

The API uses TypeORM for database migrations. Migrations are automatically run when the API starts in production mode (`migrationsRun: true`). For local development, you can run migrations manually.

### Running Migrations

**Run pending migrations**:

```bash
npm run migration:run
```

This will execute all pending migrations that haven't been applied yet.

**Revert the last migration**:

```bash
npm run migration:revert
```

This will undo the most recently applied migration.

### Creating Migrations

**Generate a migration from entity changes**:

```bash
npm run migration:generate -- migrations/MigrationName
```

This will analyze your entities and generate a migration file with the necessary SQL changes.

**Create an empty migration file**:

```bash
npm run migration:create -- migrations/MigrationName
```

This creates an empty migration file where you can write custom SQL if needed.

### Migration Configuration

- Migrations are stored in the `migrations/` directory
- The migration configuration is in `src/typeorm.config.ts`
- Migrations use the `POSTGRES_URL` environment variable for database connection
- In development mode, `synchronize: true` is enabled, which auto-syncs schema (migrations are still recommended for production)

### Note

When using Docker Compose, migrations run automatically on API startup. For local development, ensure your database is running and `POSTGRES_URL` is correctly configured before running migrations.

## How to Test the API

### 1. Health Check

```bash
curl http://localhost:3000/api/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 2. Create Article

```bash
curl -X POST http://localhost:3000/api/articles \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: unique-key-123" \
  -d '{
    "title": "Article Title",
    "content": "Article content here...",
    "source": "News Source",
    "author": "Article Author",
    "link": "https://example.com/article"
  }'
```

Expected response:

```json
{
  "status": "ok",
  "message": "News stored and queued",
  "id": "uuid-article-id"
}
```

**Note**: The `Idempotency-Key` header is optional but recommended to prevent duplicate processing.

### 3. List Articles

```bash
curl "http://localhost:3000/api/articles?page=1&limit=10"
```

Query parameters:

- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)
- `sortBy` - Sort field (default: createdAt)
- `sortOrder` - Sort order: `ASC` or `DESC` (default: DESC)

### 4. Get Article by ID

```bash
curl http://localhost:3000/api/articles/{article-id}
```

### 5. Search Articles

```bash
curl "http://localhost:3000/api/search?q=keyword&page=1&limit=10"
```

Query parameters:

- `q` - Search query (required)
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)

### 6. Autocomplete Suggestions

```bash
curl "http://localhost:3000/api/search/autocomplete?q=keyw"
```

Query parameters:

- `q` - Search query (required)
- `limit` - Maximum suggestions (default: 10)

### 7. Using Swagger UI

1. Start the API
2. Open http://localhost:3000/api/docs in your browser
3. Use the interactive Swagger UI to test all endpoints

### 8. Running Test Suite

```bash
# Install dependencies
npm install

# Run unit tests
npm test

# Run e2e tests
npm run test:e2e

# Run tests with coverage
npm run test:cov

# Run tests in watch mode
npm run test:watch
```

## API Endpoints

### Articles

- `GET /api/articles` - List articles with pagination
- `POST /api/articles` - Create a new article
- `GET /api/articles/:id` - Get article by ID

### Search

- `GET /api/search` - Full-text search articles
- `GET /api/search/autocomplete` - Get autocomplete suggestions

### Health

- `GET /api/health` - Health check endpoint

## Documentation

Swagger documentation is available at `/api/docs` when the API is running.
