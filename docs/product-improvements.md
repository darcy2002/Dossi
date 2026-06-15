# Product Improvements

## 1. Five product opportunities

1. **Research transparency.** Users see the report but not what was searched or why a section is thin. A source panel showing queries, URLs, and coverage confidence would let users validate and enrich the research.
2. **Company memory.** Researching the same company twice starts cold. Persisting past sessions and surfacing "what changed since last time" turns Dossi into an ongoing account layer, not a one-shot tool.
3. **Cross-company chat.** The most common prep question is "how do they compare to competitor X?" — extending chat to pull in a second session's research would close this gap.
4. **Mobile layout.** Reps prep on the move; the current layout is built for desktop. A responsive redesign would open the use case to in-car and between-meeting prep.
5. **Editable briefings.** The output is read-only today. Letting users annotate, mark questions answered, or highlight key sections would make the briefing theirs rather than a static document.

## 2. Top three improvements to build next

1. **Source transparency + manual URLs.** Show the queries Dossi ran and let users add URLs before generating. Improves trust and fills gaps automated search misses.
2. **Meeting notes → delta briefing.** Paste post-meeting notes; Dossi diffs them against the report and surfaces what changed and what to ask next. Turns a one-shot tool into a recurring account layer.
3. **CRM export.** One-click structured note into HubSpot/Salesforce so research turns into action instead of living in Dossi.

## 3. Who buys, who uses, why they pay

- **Buys:** Sales/RevOps leaders at B2B companies (20–500 employees), out of the same budget as the CRM and sales-engagement stack.
- **Uses:** AEs and SDRs running 3–10 discovery calls a week. They're time-constrained; the pitch is "good prep in 3 minutes, not 30."
- **Why they pay:** Better first conversations convert to more second meetings. Dossi makes thorough prep available to every rep, not just the naturally curious ones.

## 4. Success metrics

- **Primary:** Sessions per active user per week (engagement + value).
- **Quality:** Report usefulness rating (thumbs up/down), tracked by company size and provider to expose where the workflow is weak.
- **Retention:** Week-4 retention — proof it's a workflow tool, not a novelty.
- **Activation:** Time from signup to first complete report (target under 5 minutes).

## 5. Four-week AI roadmap

- **Week 1 — Vector retrieval for chat.** Embed report sections + source chunks; retrieve top-k per question instead of stuffing the whole report. Cuts per-message cost and removes the context ceiling.
- **Week 2 — Post-meeting notes node.** New LangGraph node that diffs user notes against the report into a `delta_briefing`.
- **Week 3 — Recency enrichment.** A second background pass for news, funding, and job postings in the last 30 days, added as "recent signals." No user action needed.
- **Week 4 — Competitor comparison.** Research added competitors in parallel threads; add a comparison section. Closes the top chat gap.

## 6. Scaling considerations

- **Cost:** LLM inference dominates (~$0.05–0.15/run on Haiku, ~$0.30–0.50 on Sonnet). A $49/seat covers ~100–160 Sonnet runs before margin turns negative — pricing must reflect this.
- **Horizontal scaling:** Research runs as a daemon thread inside the API process, which is the right model for a single-instance deploy. Moving to a Postgres-backed task queue (claim-and-run against the sessions table) would make the runner stateless and support horizontal scaling with no changes to the workflow itself.
- **Provider redundancy:** Tavily has a Firecrawl fallback already wired up. An LLM fallback (e.g. GPT-4o) would reduce hard-failure rate on Anthropic outages; the provider abstraction makes this a one-line config change per node.

## 7. One feature to simplify

**The `strict` flag on session creation.** It was a dev tool to force the retry loop and is exposed in the API. The quality bar should be set internally based on web coverage — surfacing this to users adds friction without benefit. Removing it simplifies the API surface and lets the workflow own that decision.

## 8. One feature to add

**A "quick brief" mode: ~90 seconds, three sections.** Website scrape + two searches, no retry loop — what they do, who they sell to, one specific opener. Most calls are volume prospecting, not high-value accounts; a fast mode serves a far larger use case and funnels users into the full product when they want depth.

## 9. First 90-day roadmap

- **Days 1–30 — Trust & reliability:** source transparency panel, a 20-company eval harness, mobile layout, JWT refresh (no logout mid-run).
- **Days 31–60 — Depth & retention:** post-meeting notes + delta briefing, vector search for chat, CRM export, a usage dashboard.
- **Days 61–90 — Scale & growth:** competitor comparison, a task queue for background jobs, shareable read-only briefing links, billing.

## 10. Next priority

**The source transparency panel.** Showing exactly what was searched, which sources were used, and where gaps remain turns the briefing into a research partner rather than a black box — and unlocks manual enrichment (add a missed URL, regenerate). It lifts quality, trust, and engagement at once.
