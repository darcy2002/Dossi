"""Database engine + table creation. Reads DATABASE_URL from settings and
works unchanged on SQLite (local) and Postgres (production)."""

from sqlmodel import Session, SQLModel, create_engine

from app.config import settings

# Importing models registers the tables on SQLModel.metadata so create_all
# can find them.
from app import models  # noqa: F401

_connect_args = (
    # timeout: wait out the checkpointer's write lock instead of erroring.
    {"check_same_thread": False, "timeout": 30}
    if settings.database_url.startswith("sqlite")
    else {}
)

engine = create_engine(settings.database_url, echo=False, connect_args=_connect_args)


def create_db_and_tables() -> None:
    """Create any tables that do not yet exist."""
    SQLModel.metadata.create_all(engine)


def get_session():
    """FastAPI dependency yielding a database session."""
    with Session(engine) as session:
        yield session
