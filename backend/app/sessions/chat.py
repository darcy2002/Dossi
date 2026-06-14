"""Grounded chat: build the grounding prompt and stream the answer over SSE."""

import json

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from sqlmodel import Session as DBSession

from app.db import engine
from app.logging_config import logger
from app.models import Message, Session as SessionModel
from app.workflow.llm import get_llm

_SYSTEM_PREFIX = (
    "You are a meeting-prep assistant for a salesperson preparing to meet the "
    "company described in the research below. Be genuinely useful: as well as "
    "answering questions, you can draft outreach emails, suggest openers and "
    "talking points, propose discovery questions, compare the company to others, "
    "and reason about strategy — building on the research.\n\n"
    "Grounding rule: every factual claim about THIS company must come from the "
    "research report and sources below. Never invent facts about them — if a "
    "fact isn't in the research, say it's not in the research rather than "
    "guessing. Drafting, framing, and reasoning on top of those facts is "
    "encouraged. If a task needs outside context (e.g. a competitor's details), "
    "you may use general knowledge but make clear what comes from the research "
    "versus general context, and never fabricate specifics about this company.\n\n"
    "Match the user's intent: if they ask for an email, write the email; if they "
    "ask a question, answer it concisely.\n\n"
)

_STYLE = (
    "Voice. Write like a real person, not an AI. Follow these rules:\n"
    "- No significance inflation or promotional language (\"pivotal moment\", "
    "\"nestled\", \"breathtaking\").\n"
    "- No AI vocabulary: testament, landscape, showcasing, delve, robust, "
    "leverage, elevate, foster, seamless, unlock, navigate.\n"
    "- Use plain verbs (\"is\", \"has\") instead of \"serves as\", \"boasts\", "
    "\"features\".\n"
    "- No negative parallelisms (\"it's not just X, it's Y\").\n"
    "- No rule-of-three lists and no forced triads.\n"
    "- Never use em dashes or en dashes anywhere. Use commas, periods, or rewrite "
    "the sentence.\n"
    "- When writing outreach, never restate the prospect's role or job title back "
    "to them. Open with one specific thing they did, not their title.\n"
    "- No signposting openers (\"let's dive in\", \"here's what you need to know\").\n"
    "- Cut filler (\"in order to\" becomes \"to\", \"due to the fact that\" becomes "
    "\"because\").\n"
    "- No excessive hedging (\"could potentially possibly\").\n"
    "- No generic conclusions (\"the future looks bright\").\n"
    "- No sycophancy and no exclamation-mark enthusiasm.\n\n"
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
        + _STYLE
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


def _strip_dashes(text: str) -> str:
    """Hard-enforce the no-em/en-dash rule regardless of the model."""
    return text.replace(" — ", ", ").replace("—", ", ").replace(" – ", ", ").replace("–", "-")


def stream_answer(session_id: int, messages: list[BaseMessage]):
    """Yield SSE token events; persist the full assistant message at the end."""
    parts: list[str] = []
    try:
        for chunk in get_llm().stream(messages):
            token = chunk.content if isinstance(chunk.content, str) else ""
            if token:
                token = _strip_dashes(token)
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
