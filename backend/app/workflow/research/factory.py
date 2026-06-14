"""Builds the research provider named by RESEARCH_PROVIDER — one switch."""

from app.config import settings
from app.workflow.research.base import ResearchProvider

_cache: dict[str, ResearchProvider] = {}


def get_provider() -> ResearchProvider:
    name = settings.research_provider.lower()
    if name not in _cache:
        if name == "tavily":
            from app.workflow.research.tavily_provider import TavilyProvider

            _cache[name] = TavilyProvider()
        elif name == "firecrawl":
            from app.workflow.research.firecrawl_provider import FirecrawlProvider

            _cache[name] = FirecrawlProvider()
        else:
            raise ValueError(f"Unknown RESEARCH_PROVIDER: {settings.research_provider}")
    return _cache[name]
