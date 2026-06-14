"""LangGraph workflow tests: the conditional retry routing, graph wiring, and
the hard-enforced no-dash voice rule. All pure/in-process — no network."""

from app.workflow.graph import MAX_RETRIES, build_graph, route_after_quality
from app.workflow.nodes import _strip_dashes


def test_route_retries_when_thin_under_cap():
    state = {"quality": {"verdict": "retry"}, "retry_count": 1}
    assert route_after_quality(state) == "research"


def test_route_stops_retrying_at_cap():
    # retry_count == MAX_RETRIES: the loop must end and produce a report.
    state = {"quality": {"verdict": "retry"}, "retry_count": MAX_RETRIES}
    assert route_after_quality(state) == "report_generation"


def test_route_passes_through_on_pass():
    state = {"quality": {"verdict": "pass"}, "retry_count": 0}
    assert route_after_quality(state) == "report_generation"


def test_graph_compiles_with_five_nodes():
    graph = build_graph().compile()
    for name in ("planner", "research", "analysis", "quality_check", "report_generation"):
        assert name in graph.nodes


def test_strip_dashes_recurses_through_report():
    report = {
        "company_overview": "A leader — really — in widgets",
        "business_signals": ["raised funds – Q1", "hiring"],
        "nested": {"note": "fast—growing"},
    }
    cleaned = _strip_dashes(report)
    blob = str(cleaned)
    assert "—" not in blob and "–" not in blob
    assert cleaned["company_overview"] == "A leader, really, in widgets"
