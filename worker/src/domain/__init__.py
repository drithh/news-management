"""Domain layer for the news worker.

This package contains:
- entities (aggregates and value objects)
- domain-specific errors
- ports (interfaces the domain depends on)
"""

from .article import (
    Article,
    ArticleNotFoundError,
    InvalidJobMessageError,
    MessageRequeueError,
)
from .article.ports import ArticleRepository
from .search.ports import SearchEngine
from .message_queue.ports import MessageConsumer

__all__ = [
    "Article",
    "ArticleNotFoundError",
    "InvalidJobMessageError",
    "MessageRequeueError",
    "ArticleRepository",
    "SearchEngine",
    "MessageConsumer",
]


