from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID


@dataclass
class Article:
    id: UUID
    title: str
    content: str
    source: str
    link: str
    created_at: datetime
    updated_at: datetime


