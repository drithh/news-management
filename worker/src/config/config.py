"""Configuration management for the news worker."""

import logging
from enum import Enum

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class LogLevel(str, Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class Config(BaseSettings):
    """Main configuration class for the worker application."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    POSTGRES_URL: str = "postgresql://news:news@localhost:5432/news"
    RABBITMQ_URL: str = "amqp://guest:guest@localhost:5672"
    ELASTICSEARCH_URL: str = "http://localhost:9200"
    ARTICLE_JOBS_QUEUE: str = "news.created"
    LOG_LEVEL: LogLevel = LogLevel.INFO

    @field_validator(
        "POSTGRES_URL",
        "RABBITMQ_URL",
        "ELASTICSEARCH_URL",
        "ARTICLE_JOBS_QUEUE",
    )
    @classmethod
    def _non_empty(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Configuration value must not be empty")
        return value


def load_config() -> Config:
    """Load configuration from environment / .env file."""
    return Config()


def setup_logger(level: LogLevel | str) -> logging.Logger:
    """Configure and return the root application logger."""
    if isinstance(level, LogLevel):
        level_name = level.value
    else:
        level_name = level

    logging.basicConfig(
        level=getattr(logging, level_name),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )
    return logging.getLogger("news-worker")


