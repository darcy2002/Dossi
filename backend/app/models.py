"""SQLModel tables. JSON columns use SQLAlchemy's generic JSON type so the
same code works on SQLite (TEXT-backed JSON) and Postgres (native JSON)."""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import JSON, CheckConstraint, Column
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# The only legal values for these columns; enforced at the DB via CHECK
# constraints (below) so a stray value can never be persisted and silently
# dropped from a status-filtered query. (SQLModel can't map a typing.Literal to
# a column, so the columns stay `str` and the CHECK does the enforcing.)
_SESSION_STATUSES = ("pending", "running", "needs_review", "complete", "failed")
_MESSAGE_ROLES = ("user", "assistant")


def _in_clause(column: str, values: tuple[str, ...]) -> str:
    quoted = ", ".join(f"'{v}'" for v in values)
    return f"{column} IN ({quoted})"


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    password_hash: str
    created_at: datetime = Field(default_factory=_utcnow)


class Session(SQLModel, table=True):
    __table_args__ = (
        CheckConstraint(_in_clause("status", _SESSION_STATUSES), name="ck_session_status"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    company_name: str
    website: str
    objective: str
    status: str = Field(default="pending")
    current_step: Optional[str] = None
    report_json: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    sources_json: Optional[list] = Field(default=None, sa_column=Column(JSON))
    error_log_json: Optional[list] = Field(default=None, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


class Message(SQLModel, table=True):
    __table_args__ = (
        CheckConstraint(_in_clause("role", _MESSAGE_ROLES), name="ck_message_role"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    session_id: int = Field(foreign_key="session.id", index=True)
    role: str  # constrained to _MESSAGE_ROLES via the CHECK constraint above
    content: str
    created_at: datetime = Field(default_factory=_utcnow)
