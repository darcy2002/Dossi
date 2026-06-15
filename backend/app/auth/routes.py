"""Auth routes: signup, login, me."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.auth.deps import get_current_user
from app.auth.schemas import LoginRequest, SignupRequest, TokenResponse, UserOut
from app.auth.security import create_access_token, hash_password, verify_password
from app.db import get_session
from app.logging_config import logger
from app.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=TokenResponse)
def signup(body: SignupRequest, session: Session = Depends(get_session)):
    existing = session.exec(select(User).where(User.email == body.email)).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = User(email=body.email, password_hash=hash_password(body.password))
    session.add(user)
    session.commit()
    session.refresh(user)

    logger.info("signup user_id=%s", user.id)
    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=UserOut(id=user.id, email=user.email))


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.email == body.email)).first()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    logger.info("login user_id=%s", user.id)
    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=UserOut(id=user.id, email=user.email))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return UserOut(id=current_user.id, email=current_user.email)
