# Engineering Decisions

## Decision 1: Multi-node graph with a quality-check retry loop vs a single LLM call

### What we built

A five-node LangGraph workflow: planner → research → analysis → quality_check → report_generation. The quality_check node can loop back to research up to twice before forcing a final report.

### What we could have done instead

One LLM call with a long prompt: "here is the company, here are some search results, write a nine-section briefing." This is simpler to build and faster to run.

### Why we chose the graph

A single-call approach has no way to improve its own output. It can only work with whatever search results the first query returned — if those are thin, the report is thin.

The graph separates concerns in a way that makes each stage auditable and improvable. The planner shapes search queries around the specific meeting objective. The quality node can identify specific gaps ("no pricing information", "no enterprise customer names") and the research node chases those gaps in the next pass. The final report synthesises verified, targeted information rather than whatever the first broad search returned.

**The retry loop earned its weight.** Kakiyo (a smaller company with limited web presence) triggered two research retries before the quality check passed. Notion passed first try. The difference: Notion has dense coverage across many URLs; Kakiyo required targeted follow-up queries to fill gaps the quality node flagged. A single-call approach would have produced a thin Kakiyo report without signalling the gap.

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

The client also makes ~90 lightweight requests per session. With dozens of concurrent sessions this becomes meaningful load. A WebSocket or SSE approach would reduce request count to near zero at the cost of more complex server-side connection management.

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

The SQLite `timeout=30` setting exists because the background research thread and the LangGraph checkpointer both write to the same SQLite file. Without the timeout, the second writer would get `database is locked` immediately. Postgres handles concurrent writes without this workaround.

---

## Top technical debt

**Prompts are not versioned or tuned systematically.** The report and chat prompts are strings embedded in Python files. There is no A/B testing, no eval framework, and no way to compare prompt versions. As the LLM improves, prompts should be treated as first-class artifacts with their own test suite.

**No vector search — context stuffing only.** The chat system injects the full 9-section report into every message. For small reports this is fine. For long ones it eats into the context window and inflates cost per message. A vector index over report sections and source content would let the chat system retrieve only what is relevant to the specific question.

**Single-instance background jobs.** Research runs as a `threading.Thread` inside the FastAPI process. With a single server instance this is fine. Scaling to multiple instances would split the background job pool — a session started on instance A would update instance B's DB correctly (they share a database) but instance A would be unaware of sessions started on B. A proper task queue (Celery, RQ, or a simple Postgres-backed queue) is the right fix before horizontal scaling.

**JWT has no refresh.** Tokens expire after 60 minutes. The user gets logged out mid-session if research takes longer than expected. A refresh token flow or a longer expiry (with a logout endpoint) would improve this.

---

## Biggest technical risk

**Dependence on Tavily and the Anthropic API, with rate limits in both.**

A Tavily outage or rate limit means research produces no sources, and the report degrades to whatever the quality check decides is "enough." The Firecrawl fallback exists but requires separate credit.

The Anthropic rate limit (10k input tokens/minute on the dev tier) is the tighter constraint. The content truncation and source caps were added specifically because two colliding research runs hit this limit during development. On a production tier with higher limits this is less of a concern — but the limits are real and the fix (content truncation) reduces report quality compared to what full source content would produce.

A mitigation: cache Tavily search results for a given (company, query) pair. Repeated research runs on the same company (retries, development testing) currently re-fetch the same pages and burn the same quota each time.

---

## What two more weeks would add

**Week 1:** Real evaluation. Run Dossi on 20 companies across sales, partnership, and investor meeting objectives. Score each report on factual accuracy, section completeness, and actionability. Use the scores to tune the planner prompt (which shapes search query quality), the quality check bar, and the report style guide. Add an eval script that can re-run the workflow on a fixed set of test cases and compare scores before and after a prompt change.

**Week 2:** Vector search for chat, and a CRM integration stub. Replace the full-report context injection with a simple embeddings search over report sections — retrieves the three most relevant chunks per question rather than the whole document. Add a `POST /sessions/{id}/export` endpoint that returns a structured summary suitable for pasting into a CRM note (HubSpot, Salesforce) — company, objective, top signals, suggested opening. This turns the briefing from a one-time read into a reusable record.
