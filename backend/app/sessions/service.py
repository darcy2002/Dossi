"""Background execution of the research workflow, driving Session.status."""

from datetime import datetime, timezone

from sqlmodel import Session as DBSession

from app.db import engine
from app.logging_config import logger
from app.models import Session as SessionModel
from app.workflow.graph import run_research


def _update(session_id: int, **fields) -> None:
    """Apply field updates to a session row using a fresh DB session."""
    with DBSession(engine) as db:
        row = db.get(SessionModel, session_id)
        if row is None:
            return
        for key, value in fields.items():
            setattr(row, key, value)
        row.updated_at = datetime.now(timezone.utc)
        db.add(row)
        db.commit()


def execute_session(
    session_id: int,
    company_name: str,
    website: str,
    objective: str,
    strict: bool = False,
    resume: bool = False,
) -> None:
    """Run the workflow for a session and persist its status lifecycle.

    Runs in a background thread; never raises (the server must stay up).
    """
    logger.info("run start session_id=%s resume=%s", session_id, resume)
    _update(session_id, status="running", error_log_json=None)

    def on_step(node_name: str, _update_dict: dict) -> None:
        _update(session_id, current_step=node_name)
        logger.info("run step session_id=%s step=%s", session_id, node_name)

    try:
        final = run_research(
            session_id, company_name, website, objective,
            strict=strict, resume=resume, on_step=on_step,
        )
        report = final.get("report")
        verdict = (final.get("quality") or {}).get("verdict")

        if not report:
            _update(session_id, status="failed", error_log_json=["no report produced"])
            logger.info("run finish session_id=%s status=failed", session_id)
            return

        status = "needs_review" if verdict == "retry" else "complete"
        _update(
            session_id,
            status=status,
            report_json=report,
            sources_json=report.get("sources"),
            current_step=None,
        )
        logger.info("run finish session_id=%s status=%s", session_id, status)
    except Exception as exc:  # noqa: BLE001 — never crash the server
        _update(session_id, status="failed", error_log_json=[str(exc)])
        logger.exception("run failed session_id=%s", session_id)
