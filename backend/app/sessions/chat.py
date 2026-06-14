"""Grounded chat: build the grounding prompt and stream the answer over SSE."""

import json

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from sqlmodel import Session as DBSession

from app.db import engine
from app.logging_config import logger
from app.models import Message, Session as SessionModel
from app.workflow.llm import get_llm

_SYSTEM_PREFIX = (
    "You are a meeting-prep assistant answering follow-up questions about one "
    "company. Answer ONLY using the research report and sources provided below. "
    "If the answer is not contained in them, say you don't have that information "
    "from the research — do not guess or use outside knowledge. Be concise.\n\n"
)


def _format_report(report: dict | None) -> str:
    if not report:
        return "(no report available)"
    lines = []
    for key, value in report.items():
        label = key.replace("_", " ").title()
        if isinstance(value, list):
            rendered = "\n".join(
                f"  - {v.get('title', '')} ({v.get('url', '')})" if isinstance(v, dict) else f"  - {v}"
                for v in value
            )
        else:
            rendered = str(value)
        lines.append(f"## {label}\n{rendered}")
    return "\n\n".join(lines)


def _format_sources(sources: list | None) -> str:
    if not sources:
        return "(no sources)"
    return "\n".join(
        f"  - {s.get('title', '')} — {s.get('url', '')}" if isinstance(s, dict) else f"  - {s}"
        for s in sources
    )


def build_messages(session: SessionModel, history: list[Message]) -> list[BaseMessage]:
    system = (
        _SYSTEM_PREFIX
        + f"COMPANY: {session.company_name}\nOBJECTIVE: {session.objective}\n\n"
        + "=== RESEARCH REPORT ===\n" + _format_report(session.report_json) + "\n\n"
        + "=== SOURCES ===\n" + _format_sources(session.sources_json)
    )
    messages: list[BaseMessage] = [SystemMessage(content=system)]
    for m in history:
        if m.role == "assistant":
            messages.append(AIMessage(content=m.content))
        else:
            messages.append(HumanMessage(content=m.content))
    return messages


def stream_answer(session_id: int, messages: list[BaseMessage]):
    """Yield SSE token events; persist the full assistant message at the end."""
    parts: list[str] = []
    try:
        for chunk in get_llm().stream(messages):
            token = chunk.content if isinstance(chunk.content, str) else ""
            if token:
                parts.append(token)
                yield f"data: {json.dumps({'delta': token})}\n\n"
        yield "data: [DONE]\n\n"
    except Exception as exc:  # noqa: BLE001 — surface a clean SSE error, don't crash
        logger.exception("chat stream failed session_id=%s", session_id)
        yield f"data: {json.dumps({'error': str(exc)})}\n\n"
    finally:
        text = "".join(parts).strip()
        if text:
            with DBSession(engine) as db:
                db.add(Message(session_id=session_id, role="assistant", content=text))
                db.commit()
            logger.info("chat reply saved session_id=%s", session_id)
