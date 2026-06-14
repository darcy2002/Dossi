# Product Improvements

## 1. Five weaknesses

1. **Research is a black box.** Users see the report but not what was searched or why a section is thin. They can't tell whether to trust it without clicking every source.
2. **No memory across sessions.** Researching the same company twice starts cold both times. No "what changed since last time."
3. **Chat is scoped to one company.** The most common prep question is "how do they compare to competitor X?" and the grounded chat can't research X.
4. **Desktop-only.** Reps prep on the move; the layout isn't built for a phone.
5. **Read-only output.** No way to edit, annotate, or mark a question answered. The briefing can't become *yours*.

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

## 6. Biggest cost, scaling, and reliability risks

- **Cost:** LLM inference dominates (~$0.05–0.15/run on Haiku, ~$0.30–0.50 on Sonnet). Pricing must cover it; a $49/seat covers ~100–160 Sonnet runs before margin turns negative.
- **Scaling:** Research runs as a daemon thread inside the API process — fine for one instance, but horizontal scaling splits the job pool. A Postgres-backed task queue (claim-and-run against the sessions table) makes the runner stateless.
- **Reliability:** Three external dependencies — Tavily, Anthropic, the database. Tavily has a Firecrawl fallback; Anthropic has none (an outage fails every run). A model fallback (e.g. GPT-4o) would cut hard-failure rate. Anthropic's rate limit is the tightest live constraint.

## 7. One feature to remove

**The `strict` flag on session creation.** It was a dev tool to force the retry loop and is exposed in the API, where it just produces slower, costlier runs that more often end in `needs_review`. Users don't need it; the quality bar should be set internally based on how much web coverage a company has.

## 8. One feature to add

**A "quick brief" mode: ~90 seconds, three sections.** Website scrape + two searches, no retry loop — what they do, who they sell to, one specific opener. Most calls are volume prospecting, not high-value accounts; a fast mode serves a far larger use case and funnels users into the full product when they want depth.

## 9. First 90-day roadmap

- **Days 1–30 — Trust & reliability:** source transparency panel, a 20-company eval harness, mobile layout, JWT refresh (no logout mid-run).
- **Days 31–60 — Depth & retention:** post-meeting notes + delta briefing, vector search for chat, CRM export, a usage dashboard.
- **Days 61–90 — Scale & growth:** competitor comparison, a task queue for background jobs, shareable read-only briefing links, billing.

## 10. What I'd change first

**The source transparency panel.** Everything depends on trusting the briefing, and trust is currently implicit — one thin report breaks it for good. Showing exactly what was searched, which sources were used, and where gaps remain turns a black box into a research partner, and unlocks manual enrichment (add a missed URL, regenerate). It lifts quality, trust, and engagement at once.
