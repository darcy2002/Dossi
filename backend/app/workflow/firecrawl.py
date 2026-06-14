"""Small Firecrawl client: scrape(url) and search(query).

Uses plain scrape and search only (cheapest credits). Every call is wrapped in
try/except: on failure it returns empty and the caller records the failure, so
a Firecrawl error never crashes the run.
"""

from typing import Optional

from app.config import settings
from app.logging_config import logger

_client = None


def _get_client():
    """Lazily build the Firecrawl client so importing this module never fails."""
    global _client
    if _client is None:
        import warnings

        with warnings.catch_warnings():
            # firecrawl v4 emits harmless pydantic field-shadowing warnings on import.
            warnings.simplefilter("ignore", UserWarning)
            from firecrawl import Firecrawl

        _client = Firecrawl(api_key=settings.firecrawl_api_key)
    return _client


def _field(obj, name, default=None):
    """Read a field from an object that may be an attribute-style object or a dict."""
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


def scrape(url: str) -> Optional[dict]:
    """Fetch clean content for one page. Returns a source dict or None on failure."""
    try:
        result = _get_client().scrape(url, formats=["markdown"])
        content = _field(result, "markdown") or ""
        metadata = _field(result, "metadata") or {}
        title = _field(metadata, "title") or url
        if not content.strip():
            logger.warning("Firecrawl scrape returned empty content: %s", url)
            return None
        return {
            "url": url,
            "title": title,
            "content": content,
            "source_type": "site",
        }
    except Exception as exc:  # noqa: BLE001 — never let Firecrawl crash the run
        logger.warning("Firecrawl scrape failed for %s: %s", url, exc)
        return None


def search(query: str, limit: int = 5) -> list[dict]:
    """Run a web search. Returns a list of source dicts (empty on failure)."""
    try:
        result = _get_client().search(query, limit=limit)
        web_results = _field(result, "web") or []
        sources: list[dict] = []
        for item in web_results:
            item_url = _field(item, "url")
            if not item_url:
                continue
            content = _field(item, "markdown") or _field(item, "description") or ""
            title = _field(item, "title") or item_url
            sources.append(
                {
                    "url": item_url,
                    "title": title,
                    "content": content,
                    "source_type": "search",
                }
            )
        return sources
    except Exception as exc:  # noqa: BLE001 — never let Firecrawl crash the run
        logger.warning("Firecrawl search failed for %r: %s", query, exc)
        return []
