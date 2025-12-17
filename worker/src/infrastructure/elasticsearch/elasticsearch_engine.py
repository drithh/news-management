from elasticsearch import Elasticsearch
from loguru import logger

from src.domain.article import Article
from src.domain.search.ports import SearchEngine


class ElasticsearchEngine(SearchEngine):
    _INDEX_NAME = "articles"

    def __init__(self, url: str):
        self._url = url
        try:
            self._client = Elasticsearch([url])
        except Exception as exc:
            logger.error("Failed to connect to Elasticsearch: {}", exc)
            raise

    def _get_client(self) -> Elasticsearch:
        return self._client

    def ensure_index_exists(self) -> None:
        """Create the index if it doesn't already exist."""
        es = self._get_client()

        if es.indices.exists(index=self._INDEX_NAME):
            return

        mapping = {
            "mappings": {
                "properties": {
                    "id": {"type": "keyword"},
                    "title": {
                        "type": "text",
                        "analyzer": "standard",
                        "fields": {
                            "raw": { "type": "keyword" },
                            "autocomplete": {
                                "type": "search_as_you_type"
                            }
                        }
                    },
                    "content": {
                        "type": "text",
                        "analyzer": "standard",
                        "fields": {
                            "raw": { "type": "keyword" } 
                        }
                    },
                    "source": {"type": "keyword"},
                    "link": {"type": "keyword"},
                    "created_at": {"type": "date"},
                    "updated_at": {"type": "date"},
                }
            }
        }

        es.indices.create(index=self._INDEX_NAME, body=mapping)
        logger.info("Created Elasticsearch index: {}", self._INDEX_NAME)

    def index_article(self, article: Article) -> None:
        """Index an article document."""
        es = self._get_client()
        self.ensure_index_exists()

        doc = {
            "id": str(article.id),
            "title": article.title,
            "content": article.content,
            "source": article.source,
            "link": article.link,
            "created_at": article.created_at.isoformat(),
            "updated_at": article.updated_at.isoformat(),
        }

        try:
            es.index(index=self._INDEX_NAME, id=str(article.id), document=doc)
            logger.info("Indexed article {} in Elasticsearch", article.id)
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.error(
                "Failed to index article {} in Elasticsearch: {}", article.id, exc
            )
            raise


