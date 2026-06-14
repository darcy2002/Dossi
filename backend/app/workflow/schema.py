"""The report schema — exactly nine sections, always produced via the LLM's
structured output so the report is never loose free text."""

import re

from pydantic import BaseModel, Field, field_validator


def coerce_str_list(value):
    """Coerce a model's list field that came back as a string into list[str].

    Cheaper models sometimes emit a numbered/bulleted string where a list is
    expected. Split on newlines and strip leading bullets/numbering. Pass real
    lists through unchanged.
    """
    if value is None:
        return []
    if isinstance(value, str):
        parts = re.split(r"\n+", value.strip())
        cleaned = [re.sub(r"^\s*(?:[-*•]|\d+[.)])\s*", "", p).strip() for p in parts]
        return [p for p in cleaned if p]
    return value


class SourceRef(BaseModel):
    url: str = Field(description="The source URL that was actually used.")
    title: str = Field(description="A short human-readable title for the source.")


class BusinessReport(BaseModel):
    """Structured meeting-prep briefing for a company."""

    company_overview: str = Field(
        description="What the company is and does, grounded in the sources."
    )
    products_and_services: str = Field(
        description="The company's products and services."
    )
    target_customers: str = Field(
        description="Who the company sells to / its target customers."
    )
    business_signals: list[str] = Field(
        description="Notable signals: growth, funding, hiring, launches, partnerships."
    )
    risks_and_challenges: list[str] = Field(
        description="Risks, challenges, or headwinds the company faces."
    )
    suggested_discovery_questions: list[str] = Field(
        description="Discovery questions to ask, derived from the findings and the meeting objective."
    )
    suggested_outreach_strategy: str = Field(
        description="Recommended outreach strategy tailored to the findings and the objective."
    )
    unknowns: list[str] = Field(
        description="What could not be determined — gaps in coverage and research failures."
    )
    sources: list[SourceRef] = Field(
        description="The real sources used to build this report."
    )

    _coerce_lists = field_validator(
        "business_signals",
        "risks_and_challenges",
        "suggested_discovery_questions",
        "unknowns",
        mode="before",
    )(coerce_str_list)
