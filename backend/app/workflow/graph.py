"""Builds, wires, and compiles the research graph, plus the checkpointer chosen
from DATABASE_URL.

The graph is returned uncompiled so the runner can compile it INSIDE the
checkpointer's `with` block (the savers manage a DB connection lifecycle).
"""

from contextlib import contextmanager
from typing import Callable, Optional

from langgraph.graph import END, START, StateGraph

from app.config import settings
from app.workflow import nodes
from app.workflow.state import WorkflowState

MAX_RETRIES = 2


def route_after_quality(state: dict) -> str:
    """Loop back to research on a thin verdict, capped at MAX_RETRIES."""
    quality = state.get("quality") or {}
    retry_count = int(state.get("retry_count") or 0)
    if quality.get("verdict") == "retry" and retry_count < MAX_RETRIES:
        return "research"
    return "report_generation"


def build_graph() -> StateGraph:
    """Return the wired (uncompiled) StateGraph builder."""
    builder = StateGraph(WorkflowState)
    builder.add_node("planner", nodes.planner)
    builder.add_node("research", nodes.research)
    builder.add_node("analysis", nodes.analysis)
    builder.add_node("quality_check", nodes.quality_check)
    builder.add_node("report_generation", nodes.report_generation)

    builder.add_edge(START, "planner")
    builder.add_edge("planner", "research")
    builder.add_edge("research", "analysis")
    builder.add_edge("analysis", "quality_check")
    builder.add_conditional_edges(
        "quality_check",
        route_after_quality,
        {"research": "research", "report_generation": "report_generation"},
    )
    builder.add_edge("report_generation", END)
    return builder


@contextmanager
def make_checkpointer(database_url: str):
    """Yield the right LangGraph checkpointer for the given DATABASE_URL.

    SQLite for `sqlite:///...`, Postgres otherwise. Both are context managers
    and need `.setup()` on first use.
    """
    if database_url.startswith("sqlite"):
        from langgraph.checkpoint.sqlite import SqliteSaver

        # sqlite:///./dossi.db -> ./dossi.db
        path = database_url.split("sqlite:///", 1)[-1] or ":memory:"
        with SqliteSaver.from_conn_string(path) as checkpointer:
            checkpointer.setup()
            yield checkpointer
    else:
        from langgraph.checkpoint.postgres import PostgresSaver

        # psycopg expects a plain postgresql:// URL, not the +psycopg variant.
        conn = database_url.replace("postgresql+psycopg://", "postgresql://")
        with PostgresSaver.from_conn_string(conn) as checkpointer:
            checkpointer.setup()
            yield checkpointer


def run_research(
    session_id,
    company_name: str,
    website: str,
    objective: str,
    strict: bool = False,
    resume: bool = False,
    on_step: Optional[Callable[[str, dict], None]] = None,
) -> dict:
    """Run the graph for one session, keyed by thread_id=session_id.

    on_step(node_name, update) is called as each node finishes (live progress).
    resume=True continues a run interrupted mid-graph from its checkpoint;
    a completed thread is re-run fresh on the same thread_id. Returns final state.
    """
    config = {"configurable": {"thread_id": str(session_id)}}

    with make_checkpointer(settings.database_url) as checkpointer:
        graph = build_graph().compile(checkpointer=checkpointer)

        stream_input = {
            "company_name": company_name,
            "website": website,
            "objective": objective,
            "strict": strict,
            "sources": [],
            "errors": [],
            "retry_count": 0,
        }
        if resume and graph.get_state(config).next:
            stream_input = None  # resume pending tasks from the checkpoint

        for chunk in graph.stream(stream_input, config, stream_mode="updates"):
            for node_name, update in chunk.items():
                if on_step:
                    on_step(node_name, update)

        snapshot = graph.get_state(config)
        return snapshot.values if (snapshot and snapshot.values) else {}
