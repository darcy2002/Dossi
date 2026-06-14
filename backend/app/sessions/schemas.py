"""Session request/response models."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class _ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class SessionCreate(BaseModel):
    company_name: str
    website: str
    objective: str
    # Forces the quality gate's high bar; used to exercise the needs_review path.
    strict: bool = False


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
