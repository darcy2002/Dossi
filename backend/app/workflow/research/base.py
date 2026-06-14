"""Research provider interface + normalized result shapes."""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class ScrapeResult:
    url: str
    title: str
    content: str
    success: bool


@dataclass
class SearchResultItem:
    url: str
    title: str
    content: str


class ResearchProvider(ABC):
    """Both methods must swallow errors (return empty / success=False) so a
    provider failure is recorded by the caller, never crashing the run."""

    @abstractmethod
    def scrape(self, url: str) -> ScrapeResult: ...

    @abstractmethod
    def search(self, query: str, max_results: int = 5) -> list[SearchResultItem]: ...
