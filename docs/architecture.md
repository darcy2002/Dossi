# Architecture

## Overview

Dossi is a three-tier system: a React frontend, a FastAPI backend, and a LangGraph workflow that runs in the background. The frontend never blocks waiting for research to finish — it polls a lightweight status endpoint and renders incrementally as the backend progresses.

---

## Request flow

```
1. User submits company + website + objective
   POST /sessions
   └─ Backend creates Session (status=pending), returns {id}
   └─ Launches threading.Thread(execute_session, daemon=True)

2. Browser polls every 2 seconds
   GET /sessions/{id}/status
   └─ Returns {status, current_step}
   └─ Polling stops when status is terminal (complete | needs_review | failed)

3. Workflow executes in background thread
   run_research(session_id, ...) with LangGraph checkpointer
   └─ Writes current_step to DB after each node (on_step callback)
   └─ Persists report_json + sources_json on completion

4. Browser fetches full report
   GET /sessions/{id}
   └─ Returns all 9 sections + sources

5. User asks a follow-up
   POST /sessions/{id}/chat  {message: "..."}
   └─ Returns SSE stream: data: {"delta": "token"} ... data: [DONE]
   └─ Backend persists full assistant message after stream ends
```

---

## The five-node LangGraph workflow

```
START
  │
  ▼
planner         "Turn objective into 3–6 research items"
  │              Structured output: PlanModel{items: list[str]}
  ▼
research         Scrape website + search each plan item
  │              On retry: also chase quality gaps
  ▼
analysis         "Draft 5-part analysis from sources only"
  │              Structured output: DraftModel
  ▼
quality_check    "Is coverage solid or thin?"
  │              Structured output: QualityModel{verdict, gaps}
  │
  ├─ verdict=retry AND retry_count < 2 ──→ back to research
  │
  └─ verdict=pass OR retry_count == 2
       │
       ▼
  report_generation   "Assemble 9-section briefing"
       │               Structured output: BusinessReport
       ▼
      END
```

### Quality-check retry loop

The loop catches gaps the first research pass misses. On retry, the research node also queries the specific gaps the quality check identified — so each pass is more targeted than the last.

MAX_RETRIES is capped at 2. A session that exhausts retries without a clean "pass" ends in `needs_review` rather than `complete`. The user can see the gaps in the `unknowns` section and hit Retry to resume from the last checkpoint.

**Evidence it works:** Running Dossi on Kakiyo (a smaller company with limited web presence) triggered two retries before the quality check passed. Running it on Notion passed on the first try. The retry count difference is visible in the checkpointer state and the session's `current_step` history.

### Structured output at every node

Every node uses LangChain's `.with_structured_output(PydanticModel)`. The LLM is forced to return a valid schema at each step. This eliminates a category of failures (truncated JSON, missing fields) that would otherwise require defensive parsing.

### Checkpointing

LangGraph writes the full graph state to the database after each node using a thread_id equal to the session_id. This means:
- A mid-run crash (server restart, rate-limit error) leaves a recoverable checkpoint.
- `POST /sessions/{id}/retry` passes `resume=True` to the workflow, which reads `.next` from the checkpoint and continues from the last completed node.
- Both SQLite and Postgres are supported via `SqliteSaver` / `PostgresSaver` — the same graph code, different checkpointer class selected at startup.

---

## Session status lifecycle

```
pending
  │  (background thread starts)
  ▼
running       current_step updates after each node
  │
  ├──→ complete      quality passed, report persisted
  ├──→ needs_review  MAX_RETRIES hit, gaps remain; report still persisted
  └──→ failed        unhandled exception; error_log_json written
```

`needs_review` is not a failure state — it means "the report exists but coverage is incomplete." The briefing is readable and useful; the `unknowns` section surfaces what couldn't be verified.

---

## Polling vs SSE

Two different mechanisms for two different use cases.

**Status polling** (React Query `refetchInterval`): Research takes 1–3 minutes. A step completes roughly every 15–30 seconds. Polling at 2-second intervals is responsive without hammering the server. When status reaches a terminal value, `refetchInterval` returns `false` and polling stops automatically.

**SSE for chat** (fetch + ReadableStream): Chat responses need to feel instant — the user is watching tokens arrive. SSE streams tokens as they generate. The browser reads `response.body.getReader()` directly (standard EventSource can't send auth headers, so `fetch` is used instead).

---

## Storage: SQLite local, Neon Postgres production

The same SQLAlchemy/SQLModel code runs on both. SQLite works with zero configuration — running the backend for the first time creates `dossi.db` automatically. Production uses Neon (serverless Postgres) with a `DATABASE_URL` swap in the environment.

The one SQLite-specific setting is `check_same_thread=False, timeout=30`. `check_same_thread` allows the background thread to write session updates. `timeout=30` prevents `database is locked` errors when the background thread and the LangGraph checkpointer write at the same time — SQLite queues the second write for up to 30 seconds rather than failing immediately.

---

## Grounded chat

The chat system is not a general assistant — it is scoped to the research it gathered. The system prompt for every chat message includes:

1. The full report (all 9 sections, formatted)
2. The source URL list
3. An explicit instruction: "every factual claim about THIS company must come from the research report and sources below. Never invent facts."

The LLM can still draft emails, suggest openers, and reason about strategy — it just can't fabricate facts about the specific company. If it tries to use something outside the research, the model is instructed to say "that's not in the research" rather than guessing.

---

## Token management

Three hard limits prevent runaway token usage or rate-limit errors:

- **Per-source content cap:** Each source is truncated to 1,200 characters before being included in a prompt.
- **Sources per prompt cap:** At most 10 sources are fed into a single LLM call (the research and analysis nodes).
- **max_tokens=8192:** Every LLM call has an explicit ceiling to prevent hanging on an oversized response.

These were calibrated against Anthropic's 10k input-token-per-minute rate limit on the development tier. The report generation node is the most expensive call; with 10 sources at 1,200 chars each, the prompt stays well under the limit.

---

## Provider swappability

Both the LLM and the research source are hot-swappable via config:

```
LLM_PROVIDER=anthropic    # or openai
LLM_MODEL=claude-opus-4-8
RESEARCH_PROVIDER=tavily  # or firecrawl
```

`get_llm()` calls `init_chat_model()` from LangChain — the same interface works for Anthropic and OpenAI. `get_provider()` returns the matching research provider from a cached factory. No node code changes when swapping.
