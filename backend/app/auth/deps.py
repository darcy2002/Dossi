"""get_current_user dependency — resolves the Bearer token to a User."""

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session

from app.auth.security import decode_token
from app.db import get_session
from app.models import User

# auto_error=False so a missing header yields our 401, not the default 403.
_bearer = HTTPBearer(auto_error=False)

_credentials_error = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    session: Session = Depends(get_session),
) -> User:
    if creds is None:
        raise _credentials_error
    try:
        payload = decode_token(creds.credentials)
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise _credentials_error

    user = session.get(User, user_id)
    if user is None:
        raise _credentials_error
    return user
