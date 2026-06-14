"""Session API tests. The background workflow launch is stubbed (see the
`client` fixture), so these exercise the API layer, ownership, and validation
without running the real graph."""

from tests.conftest import auth_headers


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
