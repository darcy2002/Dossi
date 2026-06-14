# Dossi

AI research copilot for meeting prep. Give it a company name, website, and meeting objective. It researches the company and comes back with a nine-section briefing: overview, products, customers, business signals, risks, discovery questions, outreach strategy, unknowns, and sources. Then you can chat with the briefing to draft emails, prep talking points, or dig into anything the report surfaced.

**Live URL:** _coming soon_  
**Demo video:** _coming soon_

---

## Architecture at a glance

```
Browser (React + Vite)
  ├── GET/POST /auth/*           JWT auth
  ├── POST /sessions             create session, kick off background research
  ├── GET  /sessions/{id}/status poll until terminal (2-second interval)
  ├── GET  /sessions/{id}        full report once complete
  └── POST /sessions/{id}/chat  SSE streaming chat, grounded in the report

FastAPI backend
  ├── Auth module      JWT (HS256) + bcrypt
  ├── Sessions module  CRUD + background thread launch
  └── Workflow (LangGraph)
        planner → research → analysis → quality_check → report_generation
              ↑_____________________________↓  (retry loop, max 2)

Storage
  ├── SQLite (local dev) / Neon Postgres (production)
  └── LangGraph checkpoint (same DB, separate tables)
```

The five-node graph runs in a background thread. The browser polls `/status` every two seconds until the job finishes. Chat uses SSE and is grounded entirely in the briefing — it never invents facts.

---

## Run locally

### Prerequisites

- Python 3.11+
- Node 18+ / npm
- Two API keys: **Anthropic** (LLM) and **Tavily** (web research)

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Fill in:
#   LLM_API_KEY=sk-ant-...
#   TAVILY_API_KEY=tvly-...
#   JWT_SECRET=any-long-random-string

uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev      # starts on http://localhost:3000
```

Open `http://localhost:3000`, sign up, and run your first research session.

### Standalone workflow runner (no frontend needed)

```bash
cd backend && source .venv/bin/activate
python -m app.workflow.run_workflow \
  --company "Notion" \
  --website "https://notion.so" \
  --objective "Sell them our enterprise SSO integration"
```

---

## Environment variables

| Variable | Required | Default | Notes |
|---|---|---|---|
| `LLM_API_KEY` | yes | — | Anthropic key (`sk-ant-...`) |
| `LLM_PROVIDER` | no | `anthropic` | or `openai` |
| `LLM_MODEL` | no | `claude-opus-4-8` | Use `claude-sonnet-4-6` in production |
| `TAVILY_API_KEY` | yes | — | Tavily search + scrape |
| `RESEARCH_PROVIDER` | no | `tavily` | or `firecrawl` |
| `FIRECRAWL_API_KEY` | if firecrawl | — | |
| `DATABASE_URL` | no | `sqlite:///./dossi.db` | Neon Postgres URL for production |
| `JWT_SECRET` | yes | `change-me` | Any long random string |
| `JWT_EXPIRY_MINUTES` | no | `60` | |
| `CORS_ORIGINS` | no | `http://localhost:3000` | Comma-separated list |

---

## Deploy

Free-tier deploy on Neon (Postgres) + Render (backend and frontend). The repo
ships a `render.yaml` blueprint, a `frontend/vercel.json` for the Vercel path,
and a keep-warm pinger. Full step-by-step in [docs/deployment.md](docs/deployment.md).

The short version:

1. **Neon** — create a Postgres project, copy the connection string, change its
   prefix to `postgresql+psycopg://` (selects the psycopg3 driver). This is your
   `DATABASE_URL`. Tables create themselves on first boot.
2. **Backend (Render)** — New > Blueprint > this repo. Fill in the secret env
   vars (`LLM_API_KEY`, `TAVILY_API_KEY`, `JWT_SECRET`, `DATABASE_URL`,
   `CORS_ORIGINS`). `LLM_MODEL` is set to `claude-sonnet-4-6` for production.
3. **Frontend (Render static site, or Vercel)** — set `VITE_API_URL` to the
   backend URL. The SPA rewrite is preconfigured.

> Render free services cold-start after ~15 min idle. `.github/workflows/keepalive.yml`
> pings `/health` every 10 minutes once you set a `BACKEND_URL` repo secret.

---

## Layout

```
backend/
  app/
    auth/         JWT auth (signup, login, me)
    sessions/     session CRUD, background execution, SSE chat
    workflow/
      nodes.py    five LangGraph nodes
      graph.py    graph builder + checkpointer factory
      research/   Tavily + Firecrawl providers (swappable)
    models.py     User, Session, Message (SQLModel)
    config.py     all settings from .env
frontend/
  src/
    pages/        Landing, Auth, AppLayout, Home, History, SessionView
    components/   ChatPanel, ReportView, ProgressSteps, Sidebar, ...
    lib/          api.ts, queries.ts (TanStack), auth.tsx
docs/
  architecture.md
  engineering-decisions.md
  product-improvements.md
```

---

## Tech stack

**Backend:** FastAPI, LangGraph, LangChain, SQLModel, SQLite/Postgres, Tavily, Anthropic  
**Frontend:** React, Vite, TypeScript, Tailwind CSS, TanStack Query, Framer Motion
