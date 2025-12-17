import json
from uuid import UUID

from loguru import logger

from src.app.article_service import ArticleService
from src.domain.article import InvalidJobMessageError, MessageRequeueError
from src.domain.idempotency.ports import IdempotencyChecker, IdempotencyStatus


class ArticleJobHandler:
    """Handles incoming job messages from the message queue."""

    def __init__(
        self,
        article_service: ArticleService,
        idempotency_checker: IdempotencyChecker,
    ) -> None:
        self._service = article_service
        self._idempotency = idempotency_checker

    def handle_message(self, body: bytes) -> bool:
        """Process a job message. Returns True if successfully handled.

        The worker expects messages to follow the enveloped event shape
        published by the API service:

        {
            "event": "news.created",
            "version": 1,
            "event_id": "<uuid>",
            "data": {
                "id": "<uuid>",
                "title": "<title>",
                "content": "<content>",
                "source": "<source>",
                "author": "<author>",
                "link": "<link>",
                "createdAt": "<iso8601>",
                "updatedAt": "<iso8601>"
            }
        }
        """
        try:
            message = json.loads(body.decode("utf-8"))
            self._validate_message(message)

            event_id: str = message["event_id"]
            event_type: str = message["event"]
            version: int = message["version"]
            data: dict = message["data"]

            # Currently we only handle v1 of the news.created event
            if event_type != "news.created" or version != 1:
                raise InvalidJobMessageError(
                    f"Unsupported event {event_type!r} with version {version}"
                )

            # Idempotency check using event_id as the deduplication key
            status = self._idempotency.check_and_claim(event_id, event_type)

            if status is IdempotencyStatus.COMPLETED:
                logger.info("Event {} already processed; skipping", event_id)
                return True

            if status is IdempotencyStatus.IN_PROGRESS:
                # Another worker is currently handling this event. Raise exception
                # to signal immediate requeue without counting as retry.
                logger.info(
                    "Event {} currently in progress elsewhere; requeuing",
                    event_id,
                )
                raise MessageRequeueError(
                    f"Event {event_id} is currently being processed by another worker"
                )

            # NEW event - we own processing
            article_id = UUID(data["id"])
            self._service.index_article_from_event(article_id, data)
            self._idempotency.mark_completed(event_id, event_type)
            return True

        except (json.JSONDecodeError, InvalidJobMessageError) as exc:
            logger.error("Invalid message: {}", exc)
            return False
        except Exception as exc:  
            try:
                message = json.loads(body.decode("utf-8"))
                if isinstance(message, dict) and "event_id" in message:
                    self._idempotency.mark_failed(message["event_id"], message.get("event", "unknown"))
            except Exception:  
                pass

            logger.exception("Unexpected error handling message: {}", exc)
            raise

    def _validate_message(self, message: dict) -> None:
        """Validate message structure; raise InvalidJobMessageError on failure."""

        required_top_level = ["event", "version", "event_id", "data"]
        for field in required_top_level:
            if field not in message:
                raise InvalidJobMessageError(
                    f"Missing required top-level field: {field}"
                )

        data = message["data"]
        if not isinstance(data, dict):
            raise InvalidJobMessageError("'data' field must be an object")

        required_data_fields = [
            "id",
            "title",
            "content",
            "source",
            "author",
            "link",
            "createdAt",
            "updatedAt",
        ]
        for field in required_data_fields:
            if field not in data:
                raise InvalidJobMessageError(f"Missing required data field: {field}")

        try:
            UUID(data["id"])
        except ValueError:
            raise InvalidJobMessageError("Invalid UUID format for id") from None

