"""Standalone runner for the research workflow.

Usage:
    python -m app.workflow.run_workflow \
        --company "Acme" --website "https://acme.com" \
        --objective "Sell them our analytics platform"

Prints each step as it runs, the final nine-section report, and any errors.
"""

import argparse
import re
import uuid

from app.config import settings
from app.logging_config import configure_logging, logger
from app.workflow.graph import build_graph, make_checkpointer

_STEP_ORDER = ["planner", "research", "analysis", "quality_check", "report_generation"]


def _print_report(report: dict) -> None:
    if not report:
        print("\n(no report was produced)")
        return
    print("\n" + "=" * 70)
    print("FINAL BRIEFING")
    print("=" * 70)

    def section(title, value):
        print(f"\n## {title}")
        if isinstance(value, list):
            if not value:
                print("  (none)")
            for v in value:
                if isinstance(v, dict):
                    print(f"  - {v.get('title')} — {v.get('url')}")
                else:
                    print(f"  - {v}")
        else:
            print(value)

    section("Company Overview", report.get("company_overview"))
    section("Products & Services", report.get("products_and_services"))
    section("Target Customers", report.get("target_customers"))
    section("Business Signals", report.get("business_signals"))
    section("Risks & Challenges", report.get("risks_and_challenges"))
    section("Suggested Discovery Questions", report.get("suggested_discovery_questions"))
    section("Suggested Outreach Strategy", report.get("suggested_outreach_strategy"))
    section("Unknowns", report.get("unknowns"))
    section("Sources", report.get("sources"))


def run(company: str, website: str, objective: str, thread_id: str, strict: bool) -> dict:
    initial_state = {
        "company_name": company,
        "website": website,
        "objective": objective,
        "strict": strict,
        "sources": [],
        "errors": [],
        "retry_count": 0,
    }
    config = {"configurable": {"thread_id": thread_id}}

    final_state: dict = {}
    with make_checkpointer(settings.database_url) as checkpointer:
        graph = build_graph().compile(checkpointer=checkpointer)
        print(f"\nRunning workflow for {company} ({website})")
        print(f"Objective: {objective}\n")
        for chunk in graph.stream(initial_state, config, stream_mode="updates"):
            for node_name, update in chunk.items():
                print(f"  -> step complete: {node_name}")
                final_state.update(update)
        # Pull the authoritative final state from the checkpoint.
        snapshot = graph.get_state(config)
        if snapshot and snapshot.values:
            final_state = snapshot.values

    _print_report(final_state.get("report") or {})

    errors = final_state.get("errors") or []
    print("\n" + "=" * 70)
    print(f"ERRORS ({len(errors)})")
    print("=" * 70)
    for err in errors:
        print(f"  - {err}")
    print(f"\nretry_count: {final_state.get('retry_count')}")
    return final_state


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the dossi research workflow.")
    parser.add_argument("--company", required=True)
    parser.add_argument("--website", required=True)
    parser.add_argument("--objective", required=True)
    parser.add_argument(
        "--thread-id",
        default=None,
        help="Checkpoint thread id. If omitted, a unique one is generated so the "
        "checkpointer always runs and each run starts fresh.",
    )
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Apply a strict quality bar to force the retry loop.",
    )
    args = parser.parse_args()

    configure_logging()

    # A thread_id is required for the checkpointer to persist a run. When the
    # caller doesn't supply one, generate a unique, readable id (rather than a
    # fixed default that would silently resume a finished run).
    thread_id = args.thread_id
    if not thread_id:
        slug = re.sub(r"[^a-z0-9]+", "-", args.company.lower()).strip("-") or "run"
        thread_id = f"{slug}-{uuid.uuid4().hex[:8]}"

    logger.info("Starting standalone workflow run (thread_id=%s)", thread_id)
    run(args.company, args.website, args.objective, thread_id, args.strict)


if __name__ == "__main__":
    main()
