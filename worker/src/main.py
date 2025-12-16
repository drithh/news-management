"""Worker entry point using hexagonal architecture wiring."""

from src.config.config import load_config, setup_logger


def main() -> None:
    """Application entry point."""
    config = load_config()
    logger = setup_logger(config.LOG_LEVEL)

    logger.info("Starting worker...")


def start_consumer() -> None:
    """Backwards-compatible entrypoint for Poetry script."""
    main()


if __name__ == "__main__":
    main()
