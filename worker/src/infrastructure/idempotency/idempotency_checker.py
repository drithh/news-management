from __future__ import annotations

from psycopg.errors import UniqueViolation
from loguru import logger

from src.domain.idempotency.ports import IdempotencyChecker, IdempotencyStatus
from src.infrastructure.postgres.idempotency_repository import (
    PostgresIdempotencyRepository,
)


class PostgresIdempotencyChecker(IdempotencyChecker):
    """Idempotency checker using Postgres as single source of truth.
    
    This implementation is simpler than the Redis+Postgres version and
    suitable for moderate-scale background processing where sub-millisecond
    latency is not required.
    """

    def __init__(
        self,
        repo: PostgresIdempotencyRepository,
    ) -> None:
        self._repo = repo

    def check_and_claim(self, event_id: str, resource_key: str) -> IdempotencyStatus:
        """Check idempotency status and claim the key if new.
        
        This method is safe for concurrent execution across multiple workers.
        """
        # 1. Check if record already exists
        record = self._repo.get(event_id, resource_key)
        if record is not None:
            if record.status == "COMPLETED":
                return IdempotencyStatus.COMPLETED
            if record.status == "IN_PROGRESS":
                return IdempotencyStatus.IN_PROGRESS

        # 2. Attempt to claim by inserting IN_PROGRESS
        try:
            self._repo.insert_in_progress(event_id, resource_key)
            return IdempotencyStatus.NEW
        except UniqueViolation:
            logger.debug(
                "Race condition for idempotency key {}/{} - already claimed",
                event_id,
                resource_key,
            )
            return IdempotencyStatus.IN_PROGRESS

    def mark_completed(self, event_id: str, resource_key: str) -> None:
        """Mark the idempotency key as completed."""
        self._repo.update_status(event_id, resource_key, "COMPLETED")

    def mark_failed(self, event_id: str, resource_key: str) -> None:
        """Mark the idempotency key as failed by deleting it.
        
        This allows the event to be retried on subsequent delivery.
        """
        self._repo.delete(event_id, resource_key)

