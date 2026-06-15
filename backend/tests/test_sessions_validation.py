"""Input validation on session creation: reject non-web/internal-scheme URLs at
the boundary, and strip control characters from free-text fields (prompt-injection
hardening)."""

import pytest
from sqlmodel import Session, select

from app.db import engine
from app.models import Session as SessionModel
from tests.conftest import auth_headers


def _create(client, headers, **overrides):
    body = {"company_name": "Acme", "website": "https://acme.com", "objective": "Sell X"}
    body.update(overrides)
    return client.post("/sessions", headers=headers, json=body)


@pytest.mark.parametrize(
    "website",
    ["file:///etc/passwd", "javascript:alert(1)", "data:text/html,x", "acme.com", "ftp://acme.com"],
)
def test_bad_website_scheme_rejected(client, website):
    headers = auth_headers(client)
    res = _create(client, headers, website=website)
    assert res.status_code == 422, res.text


def test_valid_website_accepted(client):
    headers = auth_headers(client)
    assert _create(client, headers, website="https://acme.com").status_code == 200


def test_blank_required_fields_rejected(client):
    headers = auth_headers(client)
    assert _create(client, headers, company_name="").status_code == 422
    assert _create(client, headers, objective="").status_code == 422


def test_control_chars_stripped_from_text(client):
    headers = auth_headers(client)
    res = _create(client, headers, company_name="Ac\nme\x00 Co", objective="Line1\r\nLine2")
    assert res.status_code == 200, res.text
    session_id = res.json()["id"]

    with Session(engine) as db:
        row = db.get(SessionModel, session_id)
    # Newlines/null are neutralized so they can't inject extra prompt lines.
    assert "\n" not in row.company_name and "\x00" not in row.company_name
    assert "\n" not in row.objective and "\r" not in row.objective


def test_overlong_fields_rejected(client):
    headers = auth_headers(client)
    assert _create(client, headers, company_name="x" * 201).status_code == 422
    assert _create(client, headers, objective="y" * 1001).status_code == 422
