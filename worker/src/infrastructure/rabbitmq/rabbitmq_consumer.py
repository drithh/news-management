import logging
from collections.abc import Callable, Mapping

import pika
from pika.adapters.blocking_connection import BlockingChannel
from pika.spec import BasicProperties

from src.domain.article import InvalidJobMessageError, MessageRequeueError
from src.domain.message_queue.ports import MessageConsumer

# Header keys for retry tracking
RETRY_COUNT_HEADER = "x-retry-count"
ORIGINAL_QUEUE_HEADER = "x-original-queue"


class RabbitMQConsumer(MessageConsumer):

    def __init__(
        self,
        url: str,
        logger: logging.Logger,
        namespace: str,
        queue_callbacks: Mapping[str, Callable[[bytes], bool]],
        max_retries: int = 3,
        initial_backoff_seconds: int = 1,
        max_backoff_seconds: int = 60,
        backoff_multiplier: float = 2.0,
    ) -> None:
        self._url = url
        self._logger = logger
        self._max_retries = max_retries
        self._initial_backoff = initial_backoff_seconds
        self._max_backoff = max_backoff_seconds
        self._backoff_multiplier = backoff_multiplier
        self._namespace = namespace
        self._queue_callbacks = queue_callbacks

    def _connect(self) -> pika.BlockingConnection:
        try:
            params = pika.URLParameters(self._url)
            connection = pika.BlockingConnection(params)
            self._logger.info("Connected to RabbitMQ")
            return connection
        except Exception as exc:
            self._logger.error("Failed to connect to RabbitMQ: %s", exc)
            raise

    def _calculate_backoff_delay(self, retry_count: int) -> int:
        delay_seconds = min(
            self._initial_backoff * (self._backoff_multiplier ** retry_count),
            self._max_backoff,
        )
        return int(delay_seconds * 1000)

    def _setup_dlx_and_dlq(self, channel: BlockingChannel) -> tuple[str, str]:
        """Set up Dead Letter Exchange and Dead Letter Queue.

        Returns:
            Tuple of (dlx_name, dlq_name)
        """
        dlx_name = f"{self._namespace}.dlx"
        dlq_name = f"{self._namespace}.dlq"

        channel.exchange_declare(
            exchange=dlx_name,
            exchange_type="direct",
            durable=True,
        )
        
        channel.queue_declare(queue=dlq_name, durable=True)
        
        # Bind DLQ to DLX
        channel.queue_bind(
            exchange=dlx_name,
            queue=dlq_name,
            routing_key=dlq_name,
        )
        
        self._logger.info(
            "Set up DLX '%s' and DLQ '%s'", dlx_name, dlq_name
        )
        return dlx_name, dlq_name

    def _setup_retry_queue(
        self, channel: BlockingChannel, main_queue: str, dlx_name: str
    ) -> str:
        retry_queue = f"{main_queue}.retry"

        # Declare retry queue with:
        # - TTL: messages expire and go to DLX
        # - DLX: routes expired messages back to main queue via routing key
        channel.queue_declare(
            queue=retry_queue,
            durable=True,
            arguments={
                "x-message-ttl": self._max_backoff * 1000,
                "x-dead-letter-exchange": dlx_name,
                "x-dead-letter-routing-key": main_queue,
            },
        )

        self._logger.info(
            "Set up retry queue '%s' for main queue '%s'",
            retry_queue,
            main_queue,
        )
        return retry_queue

    def _handle_retry_or_dlq(
        self,
        channel: BlockingChannel,
        body: bytes,
        properties: BasicProperties,
        queue_name: str,
        retry_count: int,
        dlx_name: str,
        dlq_name: str,
    ) -> None:
        if retry_count >= self._max_retries:
            # Max retries exceeded - route to DLQ
            self._logger.error(
                "Message exceeded max retries (%d), routing to DLQ",
                self._max_retries,
            )
            headers = {}
            if properties.headers:
                headers.update(properties.headers)
            headers[RETRY_COUNT_HEADER] = retry_count
            headers[ORIGINAL_QUEUE_HEADER] = queue_name
            channel.basic_publish(
                exchange=dlx_name,
                routing_key=dlq_name,
                body=body,
                properties=pika.BasicProperties(
                    headers=headers,
                    delivery_mode=2, 
                ),
            )
        else:
            delay_ms = self._calculate_backoff_delay(retry_count)
            retry_queue = f"{queue_name}.retry"

            self._logger.warning(
                "Message failed (retry %d/%d), republishing to retry queue "
                "with %dms delay",
                retry_count + 1,
                self._max_retries,
                delay_ms,
            )

            headers = {}
            if properties.headers:
                headers.update(properties.headers)
            headers[RETRY_COUNT_HEADER] = retry_count + 1
            headers[ORIGINAL_QUEUE_HEADER] = queue_name
            channel.basic_publish(
                exchange="",
                routing_key=retry_queue,
                body=body,
                properties=pika.BasicProperties(
                    headers=headers,
                    expiration=str(delay_ms),
                    delivery_mode=2,
                ),
            )

    def start_consuming(self) -> None:
        """Start consuming messages from multiple queues with their callbacks."""

        connection = self._connect()
        channel = connection.channel()

        # Process one message at a time per worker
        channel.basic_qos(prefetch_count=1)

        # Set up DLX and DLQ (shared across all queues)
        dlx_name, dlq_name = self._setup_dlx_and_dlq(channel)

        # Set up consumers for each queue
        for queue_name, callback in self._queue_callbacks.items():
            # Set up retry queue for this main queue
            self._setup_retry_queue(channel, queue_name, dlx_name)

            # Declare main queue with DLX configured for final failures
            channel.queue_declare(
                queue=queue_name,
                durable=True,
                arguments={
                    "x-dead-letter-exchange": dlx_name,
                    "x-dead-letter-routing-key": dlq_name,
                },
            )

            # Bind main queue to DLX so expired retry messages can route back
            # (retry queue DLX routes expired messages to DLX with
            # routing key = queue_name)
            channel.queue_bind(
                exchange=dlx_name,
                queue=queue_name,
                routing_key=queue_name,
            )

            def _make_on_message(
                q_name: str, cb: Callable[[bytes], bool]
            ) -> Callable:
                """Create a message handler closure for a specific queue and callback."""

                def _on_message(ch, method, properties, body: bytes):
                    """Internal RabbitMQ callback wrapping the domain callback."""
                    try:
                        # Extract retry count from headers
                        # (default to 0 for new messages)
                        retry_count = 0
                        if (
                            properties.headers
                            and RETRY_COUNT_HEADER in properties.headers
                        ):
                            retry_count = int(
                                properties.headers[RETRY_COUNT_HEADER]
                            )

                        self._logger.info(
                            "Processing message from queue '%s': %s "
                            "(retry %d/%d)",
                            q_name,
                            method.delivery_tag,
                            retry_count,
                            self._max_retries,
                        )

                        success = cb(body)

                        if success:
                            ch.basic_ack(delivery_tag=method.delivery_tag)
                            self._logger.info(
                                "Message %s acknowledged", method.delivery_tag
                            )
                        else:
                            ch.basic_ack(delivery_tag=method.delivery_tag)
                            self._handle_retry_or_dlq(
                                ch,
                                body,
                                properties,
                                q_name,
                                retry_count,
                                dlx_name,
                                dlq_name,
                            )
                    except MessageRequeueError as exc:
                        self._logger.info(
                            "Requeuing message %s immediately: %s",
                            method.delivery_tag,
                            exc,
                        )
                        ch.basic_nack(
                            delivery_tag=method.delivery_tag, requeue=True
                        )
                    except InvalidJobMessageError as exc:
                        self._logger.error(
                            "Invalid message %s, routing to DLQ: %s",
                            method.delivery_tag,
                            exc,
                        )
                        ch.basic_ack(delivery_tag=method.delivery_tag)
                        headers = {}
                        if properties.headers:
                            headers.update(properties.headers)
                        headers[RETRY_COUNT_HEADER] = 0
                        headers[ORIGINAL_QUEUE_HEADER] = q_name
                        headers["x-error-reason"] = "invalid_message"
                        ch.basic_publish(
                            exchange=dlx_name,
                            routing_key=dlq_name,
                            body=body,
                            properties=pika.BasicProperties(
                                headers=headers,
                                delivery_mode=2,
                            ),
                        )
                    except Exception as exc:
                        retry_count = 0
                        if (
                            properties.headers
                            and RETRY_COUNT_HEADER in properties.headers
                        ):
                            retry_count = int(
                                properties.headers[RETRY_COUNT_HEADER]
                            )

                        self._logger.exception(
                            "Error in message callback for %s: %s",
                            method.delivery_tag,
                            exc,
                        )
                        ch.basic_ack(delivery_tag=method.delivery_tag)
                        self._handle_retry_or_dlq(
                            ch,
                            body,
                            properties,
                            q_name,
                            retry_count,
                            dlx_name,
                            dlq_name,
                        )

                return _on_message

            on_message = _make_on_message(queue_name, callback)

            channel.basic_consume(
                queue=queue_name,
                on_message_callback=on_message,
                auto_ack=False,
            )

            self._logger.info("Registered consumer for queue '%s'", queue_name)

        queue_names = ", ".join(self._queue_callbacks.keys())
        self._logger.info(
            "Waiting for messages on queues: %s. Press CTRL+C to exit.",
            queue_names,
        )

        try:
            channel.start_consuming()
        except KeyboardInterrupt:
            self._logger.info("Shutting down worker...")
            channel.stop_consuming()
        finally:
            connection.close()
            self._logger.info("RabbitMQ connection closed")


