"""Message queue–related ports (interfaces)."""

from abc import ABC, abstractmethod


class MessageConsumer(ABC):
    """Port for consuming messages from a queue."""

    @abstractmethod
    def start_consuming(self) -> None:
        raise NotImplementedError


