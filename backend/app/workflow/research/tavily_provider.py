"""Tavily research provider — search + extract at basic depth (cheap on free tier)."""

from app.config import settings
from app.logging_config import logger
from app.workflow.research.base import ResearchProvider, ScrapeResult, SearchResultItem


class TavilyProvider(ResearchProvider):
    def __init__(self):
        self._client = None

    def _get_client(self):
        if self._client is None:
            from tavily import TavilyClient

            self._client = TavilyClient(api_key=settings.tavily_api_key)
        return self._client

    def scrape(self, url: str) -> ScrapeResult:
        try:
            result = self._get_client().extract(url, extract_depth="basic", format="markdown")
            results = result.get("results") or []
            content = results[0].get("raw_content", "") if results else ""
            if not content.strip():
                logger.warning("Tavily extract returned empty content: %s", url)
                return ScrapeResult(url=url, title=url, content="", success=False)
            return ScrapeResult(url=url, title=url, content=content, success=True)
        except Exception as exc:  # noqa: BLE001 — never crash the run
            logger.warning("Tavily extract failed for %s: %s", url, exc)
            return ScrapeResult(url=url, title=url, content="", success=False)

    def search(self, query: str, max_results: int = 5) -> list[SearchResultItem]:
        try:
            max_results = max(3, min(max_results, 5))
            result = self._get_client().search(
                query, max_results=max_results, search_depth="basic"
            )
            items: list[SearchResultItem] = []
            for r in result.get("results") or []:
                r_url = r.get("url")
                if not r_url:
                    continue
                items.append(
                    SearchResultItem(
                        url=r_url,
                        title=r.get("title") or r_url,
                        content=r.get("content") or "",
                    )
                )
            return items
        except Exception as exc:  # noqa: BLE001 — never crash the run
            logger.warning("Tavily search failed for %r: %s", query, exc)
            return []
