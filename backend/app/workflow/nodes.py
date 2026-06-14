"""The five workflow nodes. Each takes the state, sets `current_step`, and
returns the fields it updates. All grounding is in the gathered sources only.
"""

from pydantic import BaseModel, Field, field_validator

from app.logging_config import logger
from app.workflow.research.factory import get_provider
from app.workflow.llm import get_llm
from app.workflow.schema import BusinessReport, coerce_str_list

# Per-source content fed to the LLM is truncated to bound tokens/cost.
_MAX_CONTENT_CHARS = 2000


# --- Structured-output helper models (keep node outputs reliable) -----------


class PlanModel(BaseModel):
    items: list[str] = Field(
        description="3 to 6 focused research items, visibly shaped by the objective."
    )

    _coerce = field_validator("items", mode="before")(coerce_str_list)


class DraftModel(BaseModel):
    overview: str
    products: str
    customers: str
    signals: list[str]
    risks: list[str]

    _coerce = field_validator("signals", "risks", mode="before")(coerce_str_list)


class QualityModel(BaseModel):
    verdict: str = Field(description='Either "pass" or "retry".')
    gaps: list[str] = Field(
        description="Specific missing topics or thin areas to research next."
    )

    _coerce = field_validator("gaps", mode="before")(coerce_str_list)


# --- Helpers ----------------------------------------------------------------


def _format_sources(sources: list[dict]) -> str:
    """Render sources into a compact, grounded context block."""
    if not sources:
        return "(no sources were gathered)"
    blocks = []
    for i, src in enumerate(sources, 1):
        content = (src.get("content") or "")[:_MAX_CONTENT_CHARS]
        blocks.append(
            f"[{i}] {src.get('title')} ({src.get('url')})\n{content}"
        )
    return "\n\n".join(blocks)


# --- Nodes ------------------------------------------------------------------


def planner(state: dict) -> dict:
    logger.info("[planner] planning research for %s", state.get("company_name"))
    llm = get_llm().with_structured_output(PlanModel)
    prompt = (
        "You are preparing for a sales/partnership meeting. Turn the company and "
        "the meeting objective into 3 to 6 focused research items (short phrases) "
        "that, if answered, would best prepare for this specific objective. The "
        "objective must visibly shape the items.\n\n"
        f"Company: {state.get('company_name')}\n"
        f"Website: {state.get('website')}\n"
        f"Objective: {state.get('objective')}\n"
    )
    result: PlanModel = llm.invoke(prompt)
    plan = result.items[:6]
    logger.info("[planner] plan: %s", plan)
    return {"current_step": "planner", "plan": plan}


def research(state: dict) -> dict:
    logger.info("[research] gathering sources")
    provider = get_provider()
    sources = list(state.get("sources") or [])
    errors = list(state.get("errors") or [])
    seen_urls = {s.get("url") for s in sources}

    def _add(items: list[dict]):
        for item in items:
            if item and item.get("url") not in seen_urls:
                seen_urls.add(item["url"])
                sources.append(item)

    def _search(query: str):
        items = provider.search(query, max_results=3)
        if items:
            _add([
                {"url": i.url, "title": i.title, "content": i.content, "source_type": "search"}
                for i in items
            ])
        else:
            errors.append(f"search returned nothing: {query}")

    # The company's own site.
    website = state.get("website")
    if website:
        r = provider.scrape(website)
        if r.success:
            _add([{"url": r.url, "title": r.title, "content": r.content, "source_type": "site"}])
        else:
            errors.append(f"scrape failed: {website}")

    # Each plan item -> web search.
    for item in state.get("plan") or []:
        _search(f"{state.get('company_name')} {item}")

    # On a retry, also chase the gaps the quality check flagged.
    for gap in (state.get("quality") or {}).get("gaps", []):
        _search(f"{state.get('company_name')} {gap}")

    logger.info("[research] %d sources, %d errors", len(sources), len(errors))
    return {"current_step": "research", "sources": sources, "errors": errors}


def analysis(state: dict) -> dict:
    logger.info("[analysis] drafting sections")
    llm = get_llm().with_structured_output(DraftModel)
    prompt = (
        "Using ONLY the sources below, draft a grounded analysis of the company. "
        "Do not invent facts that are not supported by the sources. If something "
        "is unknown, say so briefly rather than guessing.\n\n"
        f"Company: {state.get('company_name')}\n"
        f"Objective: {state.get('objective')}\n\n"
        f"SOURCES:\n{_format_sources(state.get('sources') or [])}"
    )
    result: DraftModel = llm.invoke(prompt)
    draft = {
        "overview": result.overview,
        "products": result.products,
        "customers": result.customers,
        "signals": result.signals,
        "risks": result.risks,
    }
    return {"current_step": "analysis", "draft": draft}


def quality_check(state: dict) -> dict:
    logger.info("[quality_check] reviewing draft coverage")
    llm = get_llm().with_structured_output(QualityModel)
    bar = (
        "Apply a STRICT bar: unless coverage is thorough and well-supported across "
        "all areas, return \"retry\" with specific gaps."
        if state.get("strict")
        else "Pass if coverage is solid; return \"retry\" only if it is clearly thin."
    )
    prompt = (
        "Review the draft analysis against the sources and decide if coverage is "
        "solid or thin. " + bar + "\n"
        'Return verdict "pass" or "retry" and a list of specific gaps to fill.\n\n'
        f"DRAFT:\n{state.get('draft')}\n\n"
        f"SOURCES:\n{_format_sources(state.get('sources') or [])}"
    )
    result: QualityModel = llm.invoke(prompt)
    verdict = "retry" if result.verdict.strip().lower() == "retry" else "pass"
    retry_count = int(state.get("retry_count") or 0) + 1
    logger.info(
        "[quality_check] verdict=%s gaps=%d retry_count=%d",
        verdict,
        len(result.gaps),
        retry_count,
    )
    return {
        "current_step": "quality_check",
        "quality": {"verdict": verdict, "gaps": result.gaps},
        "retry_count": retry_count,
    }


def report_generation(state: dict) -> dict:
    logger.info("[report_generation] assembling final report")
    llm = get_llm().with_structured_output(BusinessReport)

    # Real, deduped sources actually gathered (capped to keep the report bounded).
    sources = state.get("sources") or []
    seen = set()
    source_refs = []
    for s in sources:
        url = s.get("url")
        if url and url not in seen:
            seen.add(url)
            source_refs.append({"url": url, "title": s.get("title") or url})
    source_refs = source_refs[:15]

    # Unknowns come from the quality gaps plus any errors encountered.
    gaps = (state.get("quality") or {}).get("gaps", [])
    errors = state.get("errors") or []

    prompt = (
        "Assemble the final nine-section meeting-prep briefing. Ground every "
        "section ONLY in the draft and sources below. The discovery questions and "
        "outreach strategy must be derived from the findings AND the meeting "
        "objective. Populate `unknowns` from the listed gaps and errors. The "
        "`sources` field must list the real sources provided.\n\n"
        f"Company: {state.get('company_name')}\n"
        f"Website: {state.get('website')}\n"
        f"Objective: {state.get('objective')}\n\n"
        f"DRAFT:\n{state.get('draft')}\n\n"
        f"KNOWN GAPS: {gaps}\n"
        f"RESEARCH ERRORS: {errors}\n\n"
        f"REAL SOURCES (use these in the sources field):\n{source_refs}\n\n"
        f"SOURCE CONTENT:\n{_format_sources(sources[:15])}"
    )
    report: BusinessReport = llm.invoke(prompt)

    # Guarantee gaps + errors surface under unknowns even if the model omits them.
    merged_unknowns = list(dict.fromkeys([*report.unknowns, *gaps, *errors]))
    report.unknowns = merged_unknowns
    # Guarantee the real sources are present.
    if not report.sources and source_refs:
        report.sources = source_refs  # type: ignore[assignment]

    return {"current_step": "report_generation", "report": report.model_dump()}
