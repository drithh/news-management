from dataclasses import dataclass

from src.app.article_service import ArticleService
from src.app.article_job_handler import ArticleJobHandler
from src.config.config import Config
from src.domain.idempotency.ports import IdempotencyChecker
from src.infrastructure.elasticsearch.elasticsearch_engine import ElasticsearchEngine
from src.infrastructure.idempotency.idempotency_checker import (
    PostgresIdempotencyChecker,
)
from src.infrastructure.postgres.idempotency_repository import (
    PostgresIdempotencyRepository,
)
from src.infrastructure.rabbitmq.rabbitmq_consumer import RabbitMQConsumer


@dataclass
class Container:
    """Holds all wired dependencies for the worker."""

    article_service: ArticleService
    article_job_handler: ArticleJobHandler
    article_message_consumer: RabbitMQConsumer
    idempotency_checker: IdempotencyChecker


def build_container(config: Config) -> Container:
    """Construct and wire all dependencies."""
    search_engine = ElasticsearchEngine(config.ELASTICSEARCH_URL)
    idempotency_repo = PostgresIdempotencyRepository(config.POSTGRES_URL)
    idempotency_checker = PostgresIdempotencyChecker(
        repo=idempotency_repo,
    )

    article_service = ArticleService(search_engine)
    article_job_handler = ArticleJobHandler(article_service, idempotency_checker)

    queue_callbacks = {
        'news.created': article_job_handler.handle_message
    }
    article_message_consumer = RabbitMQConsumer(
        config.RABBITMQ_URL,
        namespace="news",
        queue_callbacks=queue_callbacks,
        max_retries=config.MAX_RETRIES,
        initial_backoff_seconds=config.INITIAL_BACKOFF_SECONDS,
        max_backoff_seconds=config.MAX_BACKOFF_SECONDS,
        backoff_multiplier=config.BACKOFF_MULTIPLIER,
    )

    return Container(
        article_service=article_service,
        article_job_handler=article_job_handler,
        article_message_consumer=article_message_consumer,
        idempotency_checker=idempotency_checker,
    )


