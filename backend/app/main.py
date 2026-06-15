"""FastAPI application: startup, CORS, logging, and a health route."""

from contextlib import asynccontextmanager
from urllib.parse import urlsplit

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.auth.routes import router as auth_router
from app.config import settings
from app.db import create_db_and_tables
from app.logging_config import configure_logging, logger
from app.sessions.routes import router as sessions_router

configure_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up dossi backend")
    create_db_and_tables()
    # Log only scheme + host — never the DSN, which carries the DB password.
    _db = urlsplit(settings.database_url)
    logger.info("Database tables ready (db=%s://%s)", _db.scheme, _db.hostname or "local")
    yield
    logger.info("Shutting down dossi backend")


app = FastAPI(title="dossi", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    response = await call_next(request)
    logger.info("%s %s -> %s", request.method, request.url.path, response.status_code)
    return response


app.include_router(auth_router)
app.include_router(sessions_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
