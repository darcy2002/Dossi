"""Session routes — all protected and scoped to the current user."""

import threading

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import update
from sqlmodel import Session as DBSession
from sqlmodel import select

from app.auth.deps import get_current_user
from app.db import get_session
from app.logging_config import logger
from app.models import Message, Session as SessionModel
from app.models import User
from app.sessions.chat import build_messages, stream_answer
from app.sessions.schemas import (
    ChatRequest,
    MessageOut,
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
    from_status = row.status
    # Atomically claim the row: flip a retryable status to "running" in one
    # statement. Concurrent double-clicks race on this UPDATE, and only the one
    # that actually changes a row (rowcount == 1) goes on to launch the thread.
    result = db.execute(
        update(SessionModel)
        .where(
            SessionModel.id == session_id,
            SessionModel.status.in_(("failed", "needs_review")),
        )
        .values(status="running")
    )
    db.commit()
    if result.rowcount == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only failed or needs_review sessions can be retried",
        )
    logger.info("session retry id=%s user_id=%s from_status=%s", row.id, user.id, from_status)
    _launch(row.id, row.company_name, row.website, row.objective, resume=True)
    return SessionCreated(id=row.id, status="running")


@router.get("/{session_id}/messages", response_model=list[MessageOut])
def list_messages(
    session_id: int,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_session),
):
    _get_owned(session_id, user, db)
    return db.exec(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at.asc())
    ).all()


@router.post("/{session_id}/chat")
def chat(
    session_id: int,
    body: ChatRequest,
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_session),
):
    row = _get_owned(session_id, user, db)
    if row.status not in ("complete", "needs_review"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session has no report to chat about yet",
        )

    db.add(Message(session_id=session_id, role="user", content=body.message))
    db.commit()
    logger.info("chat message session_id=%s user_id=%s", session_id, user.id)

    history = db.exec(
        select(Message)
        .where(Message.session_id == session_id)
        .order_by(Message.created_at.asc())
    ).all()
    messages = build_messages(row, history)

    return StreamingResponse(
        stream_answer(session_id, messages),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
