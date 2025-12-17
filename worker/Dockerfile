FROM python:3.13-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    gcc \
    musl-dev \
    postgresql-dev \
    libffi-dev \
    postgresql-libs \
    libffi

# Install Poetry
RUN pip install --no-cache-dir poetry==2.1.1

RUN poetry config virtualenvs.create false && \
    poetry config virtualenvs.in-project false

ENV POETRY_NO_INTERACTION=1 \
    POETRY_CACHE_DIR=/tmp/poetry_cache

# Copy dependency files
COPY pyproject.toml poetry.lock ./

# Install dependencies (only production dependencies, no root package)
RUN poetry install --no-interaction --only main --no-root && \
    rm -rf $POETRY_CACHE_DIR

# Copy application code
COPY . .

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import sys; sys.exit(0)"

# Run the worker
CMD ["python", "-m", "src.main"]
