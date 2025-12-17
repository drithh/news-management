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
    LOG_LEVEL: LogLevel = LogLevel.INFO
    
    # Retry and backoff configuration
    MAX_RETRIES: int = 3
    INITIAL_BACKOFF_SECONDS: int = 1
    MAX_BACKOFF_SECONDS: int = 60
    BACKOFF_MULTIPLIER: float = 2.0

    @field_validator(
        "POSTGRES_URL",
        "RABBITMQ_URL",
        "ELASTICSEARCH_URL",
    )
    @classmethod
    def _non_empty(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("Configuration value must not be empty")
        return value
    
    @field_validator("MAX_RETRIES", "INITIAL_BACKOFF_SECONDS", "MAX_BACKOFF_SECONDS")
    @classmethod
    def _positive_int(cls, value: int) -> int:
        if value < 0:
            raise ValueError("Value must be non-negative")
        return value
    
    @field_validator("BACKOFF_MULTIPLIER")
    @classmethod
    def _positive_float(cls, value: float) -> float:
        if value <= 0:
            raise ValueError("Backoff multiplier must be positive")
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


