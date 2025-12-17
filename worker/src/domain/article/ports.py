from abc import ABC, abstractmethod
from uuid import UUID

from src.domain.article import Article


class ArticleRepository(ABC):

    @abstractmethod
    def get_by_id(self, article_id: UUID) -> Article | None:
        """Fetch an article by its ID."""
        raise NotImplementedError


