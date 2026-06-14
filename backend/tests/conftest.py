"""Test fixtures. Point the app at an isolated SQLite DB and dummy keys
BEFORE importing it, so nothing touches the real database or the network."""

import os

os.environ["DATABASE_URL"] = "sqlite:///./test_dossi.db"
os.environ["JWT_SECRET"] = "test-secret"
os.environ.setdefault("LLM_API_KEY", "test")
os.environ.setdefault("TAVILY_API_KEY", "test")

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel

from app.db import engine
from app.main import app
from app.sessions import routes as session_routes


@pytest.fixture(autouse=True)
def fresh_db():
    """Recreate all tables around each test for isolation."""
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    yield
    SQLModel.metadata.drop_all(engine)


@pytest.fixture
def client(monkeypatch):
    """TestClient with the background workflow launch stubbed out, so creating
    a session doesn't spawn the real LangGraph thread (no LLM/Tavily calls)."""
    monkeypatch.setattr(session_routes, "_launch", lambda *a, **k: None)
    with TestClient(app) as c:
        yield c


def auth_headers(client: TestClient, email: str = "a@example.com") -> dict[str, str]:
    """Sign up a user and return an Authorization header for them."""
    res = client.post("/auth/signup", json={"email": email, "password": "password123"})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}
