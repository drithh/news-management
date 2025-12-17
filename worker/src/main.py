"""Worker entry point using hexagonal architecture wiring."""

from loguru import logger

from src.config.config import load_config, setup_logger
from src.di.container import build_container


def main() -> None:
    """Application entry point."""
    config = load_config()
    setup_logger(config.LOG_LEVEL)

    logger.info("Starting worker...")
    container = build_container(config)

    container.article_message_consumer.start_consuming()


def start_consumer() -> None:
    """Backwards-compatible entrypoint for Poetry script."""
    main()


if __name__ == "__main__":
    main()
