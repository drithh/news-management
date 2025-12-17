from __future__ import annotations

from dataclasses import dataclass

from loguru import logger

from src.infrastructure.postgres import get_connection


@dataclass
class IdempotencyRecord:
    idempotency_key: str
    resource_path: str
    status: str


class PostgresIdempotencyRepository:
    def __init__(self, connection_url: str) -> None:
        self._connection_url = connection_url

    def _get_connection(self):
        return get_connection(self._connection_url)

    def get(self, idempotency_key: str, resource_path: str) -> IdempotencyRecord | None:
        """Fetch a record by composite key."""
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        SELECT idempotency_key, resource_path, status
                        FROM idempotency_keys
                        WHERE idempotency_key = %s AND resource_path = %s
                        """,
                        (idempotency_key, resource_path),
                    )
                    row = cur.fetchone()
        except Exception as exc:
            logger.error(
                "Failed to fetch idempotency key {}/{}: {}",
                idempotency_key,
                resource_path,
                exc,
            )
            raise

        if row is None:
            return None

        return IdempotencyRecord(
            idempotency_key=row[0],
            resource_path=row[1],
            status=row[2],
        )

    def insert_in_progress(self, idempotency_key: str, resource_path: str) -> None:
        """Insert a new IN_PROGRESS record.

        """
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        INSERT INTO idempotency_keys (idempotency_key, resource_path, status)
                        VALUES (%s, %s, 'IN_PROGRESS')
                        """,
                        (idempotency_key, resource_path),
                    )
                    conn.commit()
        except Exception as exc:
            logger.error(
                "Failed to insert idempotency key {}/{}: {}",
                idempotency_key,
                resource_path,
                exc,
            )
            raise

    def update_status(self, idempotency_key: str, resource_path: str, status: str) -> None:
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE idempotency_keys
                        SET status = %s
                        WHERE idempotency_key = %s AND resource_path = %s
                        """,
                        (status, idempotency_key, resource_path),
                    )
                    conn.commit()
        except Exception as exc:
            logger.error(
                "Failed to update idempotency key {}/{} to {}: {}",
                idempotency_key,
                resource_path,
                status,
                exc,
            )
            raise

    def delete(self, idempotency_key: str, resource_path: str) -> None:
        try:
            with self._get_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        DELETE FROM idempotency_keys
                        WHERE idempotency_key = %s AND resource_path = %s
                        """,
                        (idempotency_key, resource_path),
                    )
                    conn.commit()
        except Exception as exc:
            logger.error(
                "Failed to delete idempotency key {}/{}: {}",
                idempotency_key,
                resource_path,
                exc,
            )
            raise

