"""Firecrawl research provider — plain scrape and search (cheapest credits)."""

import threading

from app.config import settings
from app.logging_config import logger
from app.workflow.research.base import ResearchProvider, ScrapeResult, SearchResultItem


def _field(obj, name, default=None):
    """Read a field from an object that may be attribute-style or a dict."""
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


class FirecrawlProvider(ResearchProvider):
    def __init__(self):
        self._client = None
        self._client_lock = threading.Lock()

    def _get_client(self):
        # Shared across concurrent runs; lock the lazy init to build once.
        with self._client_lock:
            if self._client is None:
                import warnings

                with warnings.catch_warnings():
                    warnings.simplefilter("ignore", UserWarning)
                    from firecrawl import Firecrawl

                self._client = Firecrawl(api_key=settings.firecrawl_api_key)
            return self._client

    def scrape(self, url: str) -> ScrapeResult:
        try:
            result = self._get_client().scrape(url, formats=["markdown"])
            content = _field(result, "markdown") or ""
            metadata = _field(result, "metadata") or {}
            title = _field(metadata, "title") or url
            if not content.strip():
                logger.warning("Firecrawl scrape returned empty content: %s", url)
                return ScrapeResult(url=url, title=title, content="", success=False)
            return ScrapeResult(url=url, title=title, content=content, success=True)
        except Exception as exc:  # noqa: BLE001 — never crash the run
            logger.warning("Firecrawl scrape failed for %s: %s", url, exc)
            return ScrapeResult(url=url, title=url, content="", success=False)

    def search(self, query: str, max_results: int = 5) -> list[SearchResultItem]:
        try:
            result = self._get_client().search(query, limit=max_results)
            web_results = _field(result, "web") or []
            items: list[SearchResultItem] = []
            for item in web_results:
                item_url = _field(item, "url")
                if not item_url:
                    continue
                content = _field(item, "markdown") or _field(item, "description") or ""
                title = _field(item, "title") or item_url
                items.append(SearchResultItem(url=item_url, title=title, content=content))
            return items
        except Exception as exc:  # noqa: BLE001 — never crash the run
            logger.warning("Firecrawl search failed for %r: %s", query, exc)
            return []
