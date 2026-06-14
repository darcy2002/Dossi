"""Session routes — all protected and scoped to the current user."""

import threading

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session as DBSession
from sqlmodel import select

from app.auth.deps import get_current_user
from app.db import get_session
from app.logging_config import logger
from app.models import Session as SessionModel
from app.models import User
from app.sessions.schemas import (
    SessionCreate,
    SessionCreated,
    SessionDetail,
    SessionListItem,
    SessionStatus,
)
from app.sessions.service import execute_session

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _get_owned(session_id: int, user: User, db: DBSession) -> SessionModel:
    row = db.get(SessionModel, session_id)
    if row is None or row.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return row


def _launch(session_id: int, company: str, website: str, objective: str,
            strict: bool = False, resume: bool = False) -> None:
    threading.Thread(
        target=execute_session,
        args=(session_id, company, website, objective, strict, resume),
        daemon=True,
    ).start()


@router.post("", response_model=SessionCreated)
def create_session(
    body: SessionCreate,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_session),
):
    row = SessionModel(
        user_id=user.id,
        company_name=body.company_name,
        website=body.website,
        objective=body.objective,
        status="pending",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    logger.info("session created id=%s user_id=%s", row.id, user.id)

    _launch(row.id, body.company_name, body.website, body.objective, strict=body.strict)
    return SessionCreated(id=row.id, status=row.status)


@router.get("", response_model=list[SessionListItem])
def list_sessions(
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_session),
):
    rows = db.exec(
        select(SessionModel)
        .where(SessionModel.user_id == user.id)
        .order_by(SessionModel.created_at.desc())
    ).all()
    return rows


@router.get("/{session_id}", response_model=SessionDetail)
def get_session_detail(
    session_id: int,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_session),
):
    return _get_owned(session_id, user, db)


@router.get("/{session_id}/status", response_model=SessionStatus)
def get_session_status(
    session_id: int,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_session),
):
    return _get_owned(session_id, user, db)


@router.post("/{session_id}/retry", response_model=SessionCreated)
def retry_session(
    session_id: int,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_session),
):
    row = _get_owned(session_id, user, db)
    if row.status not in ("failed", "needs_review"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only failed or needs_review sessions can be retried",
        )
    logger.info("session retry id=%s user_id=%s from_status=%s", row.id, user.id, row.status)
    _launch(row.id, row.company_name, row.website, row.objective, resume=True)
    return SessionCreated(id=row.id, status="running")
