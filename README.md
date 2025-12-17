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

## Environment Configuration

When using Docker Compose, environment variables are automatically configured. For local development, see the README files in `api/` and `worker/` directories for detailed environment setup.

## Testing

For detailed testing instructions:

- **API Testing**: See [api/README.md](api/README.md)

## Development

For detailed development setup:

- **API Development**: See [api/README.md](api/README.md)
- **Worker Development**: See [worker/README.md](worker/README.md)
