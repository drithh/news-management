"""Search-related ports (interfaces)."""

from abc import ABC, abstractmethod

from src.domain.article import Article


class SearchEngine(ABC):
    """Port for search indexing."""

    @abstractmethod
    def ensure_index_exists(self) -> None:
        """Ensure the underlying search index exists and is ready."""
        raise NotImplementedError

    @abstractmethod
    def index_article(self, article: Article) -> None:
        """Index an article for search."""
        raise NotImplementedError


