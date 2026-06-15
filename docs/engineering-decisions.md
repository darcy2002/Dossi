# Engineering Decisions

## Decision 1: Multi-node graph with a quality-check retry loop vs a single LLM call

### What we built

A five-node LangGraph workflow: planner → research → analysis → quality_check → report_generation. The quality_check node can loop back to research up to twice before forcing a final report.

### What we could have done instead

One LLM call with a long prompt: "here is the company, here are some search results, write a nine-section briefing." This is simpler to build and faster to run.

### Why we chose the graph

A single-call approach has no way to improve its own output. It can only work with whatever search results the first query returned — if those are thin, the report is thin.

The graph separates concerns in a way that makes each stage auditable and improvable. The planner shapes search queries around the specific meeting objective. The quality node identifies specific gaps ("no pricing information", "no enterprise customer names") and the research node chases those gaps in the next pass. The final report synthesises verified, targeted information rather than whatever the first broad search returned.

**The retry loop earns its weight.** Kakiyo (a smaller company with limited web presence) triggered two research retries before the quality check passed. Notion passed first try. A single-call approach would have produced a thin Kakiyo report without signalling the gap — the graph surfaces this as `needs_review` with specific unknowns instead.

### Tradeoffs

The graph costs more in tokens and wall-clock time (1–3 minutes per run). For a sales meeting tool where the research runs once and the output is used across multiple conversations, this is acceptable. The structured output at every node (Pydantic schemas enforced by the LLM) eliminates a class of runtime failures that would be harder to guard against in a single-call approach.

---

## Decision 2: 2-second polling for progress vs SSE or WebSockets for the full session lifecycle

### What we built

The browser polls `GET /sessions/{id}/status` every two seconds using React Query's `refetchInterval`. When status becomes terminal, polling stops automatically. Chat uses SSE separately.

### Alternatives

**WebSockets:** Bidirectional, push-based, real-time. The server would push status updates as they happen instead of waiting for the next poll. Lower latency; higher complexity. Requires keeping a connection alive for 1–3 minutes per session.

**SSE for progress (like chat):** The server could stream progress events over a single SSE connection. Simpler than WebSockets; still push-based. But SSE connections are long-lived, and a server restart during research would break the connection — the client would need to reconnect and re-sync state from the DB anyway.

**Polling:** Stateless. Every poll is an independent request. The server restarts without the client noticing (it just gets a 200 on the next poll). React Query handles the interval, caching, and automatic stop — about five lines of config.

### Why polling works here

Research nodes complete on the order of 15–30 seconds each. A 2-second poll interval means the UI updates within 2 seconds of each node completing — fast enough to feel live. The total poll count for a 3-minute run is about 90 requests, each returning a tiny JSON blob. The server load is negligible.

Chat is a different story: token-by-token feedback is the expected UX. A 2-second poll for chat would feel broken. SSE is the right choice there — the server streams tokens as they generate.

### Tradeoffs

Polling is not real-time. In the worst case, a step that completes 1.9 seconds after the last poll is reported 1.9 seconds late. For a process that takes 1–3 minutes, this is invisible.

The client makes ~90 lightweight requests per session. At scale, a WebSocket or SSE approach would reduce request count to near zero — a natural upgrade path when moving to horizontal scaling.

---

## Decision 3: SQLite in development, Neon Postgres in production (same code)

### What we built

SQLAlchemy's generic `JSON` column type and SQLModel handle both databases with zero code differences. The engine is constructed from `DATABASE_URL` at startup — swap one environment variable to swap the database.

### Alternatives

**SQLite for everything:** Simpler deployment. No Postgres to manage. But SQLite is a single file; concurrent writes from multiple workers would require careful serialization or WAL mode tuning.

**Postgres everywhere:** Consistent across environments. But requires a running Postgres for local dev — either Docker or a remote instance. Adds friction for first-run setup.

**The hybrid approach:** SQLite makes local development friction-free (the file creates itself on first boot). Neon gives production a serverless, scale-to-zero Postgres that costs nothing in idle state. One environment variable separates them.

### Tradeoffs

The LangGraph checkpointer needs per-database configuration: `SqliteSaver` vs `PostgresSaver`. The `make_checkpointer()` function in `graph.py` handles this branch — it is the only place in the codebase that knows which database it's talking to.

---

## Next engineering investments

**Prompt evaluation.** The report and chat prompts are strings embedded in Python files. The next step is treating them as first-class artifacts: an eval script that runs the workflow on a fixed set of test companies, scores outputs on factual accuracy and section completeness, and makes prompt changes comparable across versions. This is the highest-leverage improvement to report quality.

**Vector search for chat.** The chat system currently injects the full 9-section report into every message. A vector index over report sections and source content would retrieve only the chunks relevant to each question — lower cost per message, higher relevance, and no context-window ceiling as reports grow.

**Postgres-backed task queue.** Research runs as a `threading.Thread` inside the FastAPI process, which is the right model for a single-instance deploy. Replacing this with a Postgres-backed queue (claim-and-run against the sessions table) would make the runner stateless and allow horizontal scaling with no changes to the workflow itself.

**JWT refresh.** Tokens currently expire after 60 minutes. A refresh token flow or sliding expiry would ensure a long-running research session never logs a user out mid-briefing.

---

## Provider dependencies and resilience

The research pipeline depends on Tavily (search + scrape) and the Anthropic API. Both are handled defensively: a Firecrawl fallback is already wired in for Tavily, and the provider abstraction makes adding an LLM fallback (e.g. GPT-4o) a one-line config change per node.

Content truncation (1,200 chars per source, 10 sources max per prompt) keeps inference calls within rate limits on development-tier API keys. On a production tier with higher limits, these caps can be relaxed to improve report depth — they are configuration values, not architectural constraints.

Caching Tavily results for a given (company, query) pair is a natural next step: repeated research runs on the same company during retries or development currently re-fetch the same pages.

---

## What two more weeks would add

**Week 1:** Real evaluation. Run Dossi on 20 companies across sales, partnership, and investor meeting objectives. Score each report on factual accuracy, section completeness, and actionability. Use the scores to tune the planner prompt (which shapes search query quality), the quality check bar, and the report style guide. Add an eval script that can re-run the workflow on a fixed set of test cases and compare scores before and after a prompt change.

**Week 2:** Vector search for chat, and a CRM integration stub. Replace the full-report context injection with a simple embeddings search over report sections — retrieves the three most relevant chunks per question rather than the whole document. Add a `POST /sessions/{id}/export` endpoint that returns a structured summary suitable for pasting into a CRM note (HubSpot, Salesforce) — company, objective, top signals, suggested opening. This turns the briefing from a one-time read into a reusable record.
