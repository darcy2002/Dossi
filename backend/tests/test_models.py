"""DB-level CHECK constraints: status/role columns reject values outside their
allowed set, so a stray value can't be persisted and silently dropped from a
filtered query."""

import pytest
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from app.db import engine
from app.models import Message, Session as SessionModel, User


def _make_user(db) -> int:
    user = User(email="m@example.com", password_hash="hash")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user.id


def test_invalid_session_status_rejected():
    with Session(engine) as db:
        uid = _make_user(db)
        db.add(SessionModel(
            user_id=uid, company_name="A", website="https://a.com",
            objective="o", status="Complete",  # not in the allowed set
        ))
        with pytest.raises(IntegrityError):
            db.commit()


def test_valid_session_statuses_accepted():
    with Session(engine) as db:
        uid = _make_user(db)
        for status in ("pending", "running", "needs_review", "complete", "failed"):
            db.add(SessionModel(
                user_id=uid, company_name="A", website="https://a.com",
                objective="o", status=status,
            ))
        db.commit()  # no IntegrityError


def test_invalid_message_role_rejected():
    with Session(engine) as db:
        uid = _make_user(db)
        sess = SessionModel(user_id=uid, company_name="A", website="https://a.com", objective="o")
        db.add(sess)
        db.commit()
        db.refresh(sess)
        db.add(Message(session_id=sess.id, role="bot", content="hi"))  # invalid role
        with pytest.raises(IntegrityError):
            db.commit()
