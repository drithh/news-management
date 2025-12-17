"""Idempotency-related ports (interfaces) for the worker."""

from __future__ import annotations

from abc import ABC, abstractmethod
from enum import Enum


class IdempotencyStatus(str, Enum):
    NEW = "NEW"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


class IdempotencyChecker(ABC):
    @abstractmethod
    def check_and_claim(self, event_id: str, resource_key: str) -> IdempotencyStatus:
        """Check current status and claim the idempotency key if it's new.

        Implementations must be safe to call concurrently from multiple
        workers. When this returns NEW, the caller "owns" the key and may
        proceed with processing.
        """

        raise NotImplementedError

    @abstractmethod
    def mark_completed(self, event_id: str, resource_key: str) -> None:
        """Mark the idempotency key as COMPLETED so future calls can short-circuit."""

        raise NotImplementedError

    @abstractmethod
    def mark_failed(self, event_id: str, resource_key: str) -> None:
        """Mark the idempotency key as failed/clear it to allow retry."""

        raise NotImplementedError


