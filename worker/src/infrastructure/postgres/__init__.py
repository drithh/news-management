"""PostgreSQL infrastructure adapter and setup."""

from typing import Any, cast

import psycopg
from psycopg.rows import dict_row


def get_connection(connection_url: str):
    """Create a psycopg connection with a dict-based row factory.

    Centralised here so multiple repositories can share the same setup.
    """
    return psycopg.connect(
        connection_url,
        row_factory=cast(Any, dict_row),
    )

