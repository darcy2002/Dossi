"""Session request/response models."""

import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.url_safety import has_web_scheme

# Strip ASCII control characters (newlines, etc.) from free-text fields so a
# crafted value can't inject extra instructions into the LLM prompts built from
# them downstream.
_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")


class _ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class SessionCreate(BaseModel):
    company_name: str = Field(min_length=1, max_length=200)
    website: str = Field(min_length=1, max_length=2000)
    objective: str = Field(min_length=1, max_length=1000)
    # Forces the quality gate's high bar; used to exercise the needs_review path.
    strict: bool = False

    @field_validator("company_name", "objective", mode="before")
    @classmethod
    def _clean_text(cls, value):
        if isinstance(value, str):
            return _CONTROL_CHARS.sub(" ", value).strip()
        return value

    @field_validator("website")
    @classmethod
    def _validate_website(cls, value):
        # Reject file:/javascript:/schemeless input at the boundary; the scraper
        # additionally blocks internal hosts at request time (SSRF).
        if not has_web_scheme(value):
            raise ValueError("website must be an http(s):// URL")
        return value.strip()


class SessionCreated(BaseModel):
    id: int
    status: str


class SessionListItem(_ORMModel):
    id: int
    company_name: str
    status: str
    created_at: datetime


class SessionDetail(_ORMModel):
    id: int
    company_name: str
    website: str
    objective: str
    status: str
    current_step: Optional[str] = None
    report_json: Optional[dict] = None
    sources_json: Optional[list] = None
    error_log_json: Optional[list] = None
    created_at: datetime
    updated_at: datetime


class SessionStatus(_ORMModel):
    id: int
    status: str
    current_step: Optional[str] = None


class ChatRequest(BaseModel):
    message: str


class MessageOut(_ORMModel):
    id: int
    role: str
    content: str
    created_at: datetime
