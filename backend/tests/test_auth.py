"""Auth API tests: signup, login, token validation, and password hashing."""

from sqlmodel import Session, select

from app.db import engine
from app.models import User
from tests.conftest import auth_headers


def test_signup_returns_token_and_hashes_password(client):
    res = client.post("/auth/signup", json={"email": "u@example.com", "password": "password123"})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["access_token"]
    assert body["user"]["email"] == "u@example.com"

    # Stored password must be a bcrypt hash, never the plaintext.
    with Session(engine) as db:
        user = db.exec(select(User).where(User.email == "u@example.com")).first()
    assert user.password_hash != "password123"
    assert user.password_hash.startswith("$2")  # bcrypt prefix


def test_duplicate_signup_is_rejected(client):
    client.post("/auth/signup", json={"email": "dup@example.com", "password": "password123"})
    res = client.post("/auth/signup", json={"email": "dup@example.com", "password": "password123"})
    assert res.status_code == 400


def test_login_wrong_password_401_correct_200(client):
    client.post("/auth/signup", json={"email": "l@example.com", "password": "password123"})

    bad = client.post("/auth/login", json={"email": "l@example.com", "password": "wrong"})
    assert bad.status_code == 401

    good = client.post("/auth/login", json={"email": "l@example.com", "password": "password123"})
    assert good.status_code == 200
    assert good.json()["access_token"]


def test_me_requires_valid_token(client):
    assert client.get("/auth/me").status_code == 401

    headers = auth_headers(client, "me@example.com")
    res = client.get("/auth/me", headers=headers)
    assert res.status_code == 200
    assert res.json()["email"] == "me@example.com"
