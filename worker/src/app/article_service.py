from datetime import datetime
from uuid import UUID

from src.domain.article import Article
from src.domain.search.ports import SearchEngine


class ArticleService:
    """Application service orchestrating article-related operations."""

    def __init__(
        self,
        search_engine: SearchEngine,
        logger,
    ) -> None:
        self._search_engine = search_engine
        self._logger = logger

    def index_article_from_event(self, article_id: UUID, data: dict) -> None:
        """Index an article in Elasticsearch using event payload data.

        The event payload is expected to contain the full article row fields
        (id, title, content, source, link, createdAt, updatedAt).
        """
        self._logger.info("Indexing article %s from event", article_id)

        article = Article(
            id=article_id,
            title=data["title"],
            content=data["content"],
            source=data["source"],
            link=data["link"],
            created_at=_parse_iso8601(data["createdAt"]),
            updated_at=_parse_iso8601(data["updatedAt"]),
        )

        self._search_engine.index_article(article)
        self._logger.info("Indexed article %s", article_id)


def _parse_iso8601(value: str) -> datetime:
    """Parse an ISO 8601 datetime string into a `datetime`.

    We intentionally rely on `fromisoformat`, which supports the format
    produced by ``datetime.isoformat`` in the API service.
    """
    return datetime.fromisoformat(value)

