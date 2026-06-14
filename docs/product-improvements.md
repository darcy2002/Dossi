# Product Improvements

## Five weaknesses

**1. Research quality is opaque.** The user submits a company and gets back a report. They have no visibility into what Dossi searched for, which sources it used, or why certain sections are thin. The `unknowns` field surfaces gaps, but only after the fact. A user preparing for a high-stakes meeting cannot tell whether to trust the briefing without clicking through each source link manually.

**2. No memory across sessions.** If you research the same company twice — before an intro call and again before a follow-up — Dossi treats them as entirely separate jobs. There is no way to say "I already know the basics, tell me what changed" or "update the account with what I learned in the last meeting." Every session starts cold.

**3. The chat is limited to one company's research.** The most common pre-meeting question is "how do they compare to [competitor]?" Dossi can reason about this in general terms but cannot research the competitor within the same session. The grounding constraint is correct — but the scope is too narrow for real meeting prep, where context beyond one company matters.

**4. No mobile experience.** The interface is desktop-first. Sales people do their prep on the go — in the car, at an airport, between back-to-back meetings. The current layout is not usable on a phone screen.

**5. Output is read-only.** The briefing is a structured document with no way to edit, annotate, or highlight. A user might want to add their own notes, mark a question as already answered, or flag a risk they know is outdated. The report is static and there is no way to make it yours.

---

## Top three improvements to build next

**1. Source transparency panel.** Show the search queries Dossi ran and let users add URLs manually before the report generates. A salesperson who knows the company already — they follow the CEO on LinkedIn, they saw a press release last week — should be able to inject that context directly rather than hoping Tavily surfaces it. This improves trust and fills the gaps the automated research misses.

**2. Meeting notes input + delta briefing.** After the first meeting, let the user paste notes or a transcript. Dossi reads those against the existing briefing, flags what changed, and surfaces new questions to ask in the follow-up. This turns the product from a one-shot research tool into a persistent account intelligence layer — the kind of thing that justifies a recurring subscription.

**3. CRM export.** One-click export to HubSpot or Salesforce: structured summary (company, objective, top signals, risks, suggested opening) formatted as a CRM note. This closes the loop between research and action. Right now the briefing lives in Dossi and has to be manually re-entered into whatever the sales team actually uses to track accounts.

---

## Who buys, who uses, and why they pay

**Who buys:** Sales managers and revenue operations teams at B2B companies with 20–500 employees. They are looking for tools that reduce the time reps spend on manual pre-call research and increase the quality of first conversations. They pay per seat or per team, out of a software budget alongside their CRM and sales engagement tools.

**Who uses:** Account executives and SDRs who run 3–10 discovery calls per week. They are time-constrained. The appeal is not "deeper research" — it is "good enough research in 3 minutes instead of 30." They pay attention to whether the briefing is accurate and whether the suggested openers are specific enough to feel personal, not generic.

**Why they pay:** Meeting prep done well converts to more second meetings. A rep who walks into a call knowing the company's recent hiring signals, a specific product change, and a plausible hypothesis for why they might have budget right now will outperform one who read the homepage. Dossi makes the high-quality version of prep accessible to every rep, not just the ones who are naturally curious.

---

## Success metrics

**Primary:** Sessions created per active user per week. A user who researches one company per week is engaged; a user who researches five is a power user and a retention signal.

**Quality:** Report usefulness rating (thumbs up/down, surfaced at the end of the chat session). Track this by company size (large companies with dense web presence vs small companies with thin coverage) and by research provider. The gap shows where the workflow needs improvement.

**Retention:** Week-4 retention rate. If users return after four weeks, the product has demonstrated recurring value — they are using it as a workflow tool, not a novelty.

**Business:** Time-to-first-report (sign up → complete report). If this is under 5 minutes, the product sells itself on the first session. If it is over 10 minutes, churn will be high regardless of report quality.

---

## Four-week AI roadmap

**Week 1:** Replace context stuffing with vector retrieval for chat. Embed report sections and source chunks at report-completion time. On each chat message, retrieve the top-3 most relevant chunks and inject only those into the system prompt. This cuts per-message token cost by 60–70% and removes the context-window ceiling on long reports.

**Week 2:** Add a post-meeting notes node. New LangGraph node that takes user-pasted notes (transcript, bullet points, anything), diffs them against the existing report, and produces a `delta_briefing`: what you learned, what changed, what to follow up on. Store the delta as a new session type linked to the original session.

**Week 3:** Automated insight enrichment. After the first research pass, run a second background job that searches for news, funding events, and job postings in the past 30 days. Add these as "recent signals" to the briefing. This requires no user action and dramatically improves the relevance of the report for time-sensitive meetings.

**Week 4:** Competitor comparison. Let users add competitor companies to a session. Dossi researches each one in parallel (separate workflow threads) and adds a comparison section to the report: how the companies differ on product, market position, and pricing signals. This directly addresses the most common chat request ("how do they compare to X?").

---

## Biggest cost, scaling, and reliability risks

**Cost:** LLM inference is the dominant variable cost. A research run costs roughly $0.05–0.15 in Anthropic API fees (Haiku in development; Sonnet in production pushes this toward $0.30–0.50). At scale, per-run LLM cost must be offset by pricing — a $49/month seat covers roughly 100–160 research sessions before LLM margin turns negative, assuming Sonnet.

**Scaling:** The biggest constraint is the background threading model. Research runs as a daemon thread inside the FastAPI process. A single server handles 10–20 concurrent sessions comfortably (most of the time is waiting on Tavily and Anthropic, not CPU). But horizontal scaling across multiple server instances creates state-splitting: the background job runs on whichever instance handled the POST request. A Postgres-backed task queue (or a simple "claim and run" pattern against the sessions table) would make the job runner stateless and horizontally scalable.

**Reliability:** Three single points of failure: Tavily (research fails with no sources), Anthropic (report generation fails or rate-limits), and the database connection. Tavily already has a fallback (Firecrawl), though it requires separate credentials. Anthropic has no fallback — if the API is down, every research run fails. The `needs_review` state provides a graceful degradation path (partial reports are still useful), but a model fallback (GPT-4o as backup) would reduce hard failure rate.

---

## One feature to remove and why

**Remove the `strict` flag from the session creation API.**

`POST /sessions` accepts `strict: bool` which forces the quality check to apply a higher bar. This was added as a testing mechanism during development to force the retry loop. It is exposed in the API, which means any client can accidentally (or intentionally) set it, resulting in slower, more expensive research runs with a higher chance of ending in `needs_review`.

Users do not need to control this. The quality bar should be tuned internally based on company coverage density (a startup with three pages of web presence needs a different bar than a public company). Remove the parameter from the API and move the decision inside the workflow itself.

---

## One feature to add and why

**Add a "quick brief" mode: five minutes, three sections.**

The full research run takes 1–3 minutes and produces a nine-section briefing. For a cold prospecting call with five minutes of prep time, this is overkill and the user may not even read it all. A quick brief mode would cap the research to website scrape + two searches, skip the retry loop, and produce a three-section output: what they do, who they sell to, one specific thing to open with. This runs in under 90 seconds.

The reason to add it: the current product optimises for depth over speed. But the majority of sales calls are not high-value accounts with thorough prep — they are volume prospecting. A lightweight mode that fits into a 5-minute pre-call window would serve a much larger total addressable use case, and it would pull users into the full product when they want more depth.

---

## 90-day roadmap

**Days 1–30: Trust and reliability.**
- Source transparency panel (show search queries, allow URL injection before report).
- Evaluation harness: 20-company test suite, score each report.
- Mobile layout (responsive rewrite, not a new app).
- Fix JWT refresh (session expiry during long research runs).

**Days 31–60: Depth and retention.**
- Post-meeting notes input + delta briefing.
- Vector search for chat (replace full-context injection).
- CRM export (HubSpot/Salesforce note format).
- User-level usage dashboard (sessions run, quality ratings, time saved estimate).

**Days 61–90: Scale and growth.**
- Competitor comparison (parallel research sessions).
- Task queue for background jobs (remove threading model, enable horizontal scaling).
- Shareable briefing links (read-only view of a report for a colleague).
- Pricing and billing integration.

---

## What you would change first

The source transparency panel.

Everything else in the product depends on the user trusting the briefing. Right now, trust is implicit — the user submits a company and hopes the sources were good. One thin report from a company with limited web coverage is enough to shake that trust permanently.

Showing the user exactly what was searched, which sources were used, and where gaps remain transforms the product from a black box into a research partner. It also unlocks manual enrichment: a user who sees that Dossi missed a specific press release can add the URL and regenerate. That single change improves output quality, increases trust, and gives users a reason to engage more deeply with each report rather than skim it for the highlights.
