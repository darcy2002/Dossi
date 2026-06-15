"""Builds the research provider named by RESEARCH_PROVIDER — one switch."""

import threading

from app.config import settings
from app.workflow.research.base import ResearchProvider

_cache: dict[str, ResearchProvider] = {}
_lock = threading.Lock()


def get_provider() -> ResearchProvider:
    name = settings.research_provider.lower()
    # Concurrent runs share this cache; lock so two threads don't both build a
    # provider (check-then-set race) on first use.
    with _lock:
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
