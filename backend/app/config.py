"""Application settings loaded from environment / .env file."""

import json
from typing import Annotated

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# Placeholder JWT secrets shipped in config/.env.example — never valid in prod.
_DEFAULT_JWT_SECRETS = {"change-me", "change-me-to-a-long-random-string"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Research provider — "tavily" or "firecrawl" (swappable in one place)
    research_provider: str = "tavily"
    tavily_api_key: str = ""
    firecrawl_api_key: str = ""

    # LLM (provider/model are plain swappable strings)
    llm_provider: str = "anthropic"
    llm_api_key: str = ""
    llm_model: str = "claude-opus-4-8"

    # Database — local SQLite by default; a Neon Postgres URL in production.
    database_url: str = "sqlite:///./dossi.db"

    # Auth
    jwt_secret: str = "change-me"
    jwt_expiry_minutes: int = 60

    # CORS — NoDecode skips pydantic-settings' JSON decoding so the validator
    # below can accept a plain comma-separated string from the env.
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_cors_origins(cls, value):
        # pydantic-settings tries to JSON-decode list-typed env vars, which
        # breaks on a bare comma-separated string. Accept both forms.
        if isinstance(value, str):
            value = value.strip()
            if not value:
                return []
            if value.startswith("["):
                value = json.loads(value)  # JSON array form
            else:
                value = [origin.strip() for origin in value.split(",") if origin.strip()]
        # A "*" origin is incompatible with allow_credentials=True (main.py) and
        # would let any site make credentialed cross-origin requests.
        if isinstance(value, list) and "*" in value:
            raise ValueError('cors_origins cannot be "*" while credentials are allowed')
        return value

    @model_validator(mode="after")
    def _require_real_jwt_secret(self):
        # On anything other than local SQLite (i.e. production), refuse to boot
        # with the public placeholder secret — otherwise anyone can forge tokens.
        if self.jwt_secret in _DEFAULT_JWT_SECRETS and not self.database_url.startswith("sqlite"):
            raise ValueError("JWT_SECRET must be set to a real secret in production")
        return self


settings = Settings()
