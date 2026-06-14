"""Shared workflow state — one object every node reads and writes.

The graph is linear within each super-step (only one node runs at a time), so
nodes that grow a list (sources, errors) simply read the existing value and
return the merged list; no custom channel reducers are required.
"""

from typing import TypedDict


class WorkflowState(TypedDict, total=False):
    # Inputs
    company_name: str
    website: str
    objective: str

    # Planner output: research focus items (strings)
    plan: list[str]

    # Research output: each source is {url, title, content, source_type}
    # where source_type is "site" or "search".
    sources: list[dict]

    # Analysis output: the in-progress sections.
    # {overview, products, customers, signals, risks}
    draft: dict

    # Quality check output: {verdict: "pass"|"retry", gaps: [str]}
    quality: dict
    retry_count: int

    # Final structured report (BusinessReport.model_dump()).
    report: dict

    # Which node is active (for later progress display).
    current_step: str

    # Anything that failed along the way.
    errors: list[str]

    # When True, the quality check applies a deliberately high bar — used to
    # force the retry loop during testing.
    strict: bool
