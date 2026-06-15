"""Session API tests. The background workflow launch is stubbed (see the
`client` fixture), so these exercise the API layer, ownership, and validation
without running the real graph."""

from sqlmodel import Session

from app.db import engine
from app.models import Session as SessionModel
from tests.conftest import auth_headers


def _set_status(session_id: int, status: str) -> None:
    """Force a session's status directly in the DB (the workflow is stubbed)."""
    with Session(engine) as db:
        row = db.get(SessionModel, session_id)
        row.status = status
        db.add(row)
        db.commit()


def test_create_and_list_session(client):
    headers = auth_headers(client)
    res = client.post(
        "/sessions",
        headers=headers,
        json={"company_name": "Acme", "website": "https://acme.com", "objective": "Sell them X"},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["status"] == "pending"
    session_id = body["id"]

    listed = client.get("/sessions", headers=headers)
    assert listed.status_code == 200
    assert any(s["id"] == session_id for s in listed.json())


def test_other_user_cannot_see_session(client):
    owner = auth_headers(client, "owner@example.com")
    created = client.post(
        "/sessions",
        headers=owner,
        json={"company_name": "Acme", "website": "https://acme.com", "objective": "X"},
    )
    session_id = created.json()["id"]

    intruder = auth_headers(client, "intruder@example.com")
    res = client.get(f"/sessions/{session_id}", headers=intruder)
    assert res.status_code == 404  # never leak existence


def test_chat_before_report_is_rejected(client):
    headers = auth_headers(client)
    created = client.post(
        "/sessions",
        headers=headers,
        json={"company_name": "Acme", "website": "https://acme.com", "objective": "X"},
    )
    session_id = created.json()["id"]  # status is "pending" (workflow stubbed)

    res = client.post(f"/sessions/{session_id}/chat", headers=headers, json={"message": "hi"})
    assert res.status_code == 400


def test_protected_route_requires_auth(client):
    assert client.get("/sessions").status_code == 401


def _create_session(client, headers) -> int:
    res = client.post(
        "/sessions",
        headers=headers,
        json={"company_name": "Acme", "website": "https://acme.com", "objective": "X"},
    )
    return res.json()["id"]


def test_retry_rejected_unless_failed_or_needs_review(client):
    headers = auth_headers(client)
    session_id = _create_session(client, headers)  # status "pending"
    res = client.post(f"/sessions/{session_id}/retry", headers=headers)
    assert res.status_code == 400


def test_retry_claims_a_failed_session(client):
    headers = auth_headers(client)
    session_id = _create_session(client, headers)
    _set_status(session_id, "failed")

    res = client.post(f"/sessions/{session_id}/retry", headers=headers)
    assert res.status_code == 200
    assert res.json()["status"] == "running"


def test_retry_is_not_reclaimable_once_running(client):
    """The atomic claim must reject a second retry once the row is 'running',
    so a double-click can't launch the workflow twice."""
    headers = auth_headers(client)
    session_id = _create_session(client, headers)
    _set_status(session_id, "needs_review")

    first = client.post(f"/sessions/{session_id}/retry", headers=headers)
    assert first.status_code == 200  # claimed -> running

    second = client.post(f"/sessions/{session_id}/retry", headers=headers)
    assert second.status_code == 400  # already running, not reclaimable


def test_retry_requires_ownership(client):
    owner = auth_headers(client, "owner2@example.com")
    session_id = _create_session(client, owner)
    _set_status(session_id, "failed")

    intruder = auth_headers(client, "intruder2@example.com")
    res = client.post(f"/sessions/{session_id}/retry", headers=intruder)
    assert res.status_code == 404  # never leak existence
