"""SQLModel tables. JSON columns use SQLAlchemy's generic JSON type so the
same code works on SQLite (TEXT-backed JSON) and Postgres (native JSON)."""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    password_hash: str
    created_at: datetime = Field(default_factory=_utcnow)


class Session(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    company_name: str
    website: str
    objective: str
    # One of: pending, running, needs_review, complete, failed.
    status: str = Field(default="pending")
    current_step: Optional[str] = None
    report_json: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    sources_json: Optional[list] = Field(default=None, sa_column=Column(JSON))
    error_log_json: Optional[list] = Field(default=None, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


class Message(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="session.id", index=True)
    role: str  # "user" or "assistant"
    content: str
    created_at: datetime = Field(default_factory=_utcnow)
