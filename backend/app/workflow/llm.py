"""LLM client built from config — the single place the provider/model is chosen.

Every node gets its model from here, so swapping provider (anthropic <-> openai)
or model is a `.env`/config change only, never a code change in the nodes.
"""

from langchain.chat_models import init_chat_model

from app.config import settings


def get_llm(temperature: float = 0.0, max_tokens: int = 8192):
    """Return a LangChain chat model configured from settings.

    max_tokens defaults high enough for the full nine-section structured report;
    it is a ceiling, not a target, so small node outputs are unaffected.
    """
    return init_chat_model(
        settings.llm_model,
        model_provider=settings.llm_provider,
        api_key=settings.llm_api_key,
        temperature=temperature,
        max_tokens=max_tokens,
    )
