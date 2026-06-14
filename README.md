# dossi

AI Research Copilot for meeting prep. Give it a company name, website, and an
objective; a LangGraph workflow researches the company and produces a structured
briefing, a grounded chat answers follow-ups, and everything persists.

This repo is being built in phases. **Phase 0** is a thin, running FastAPI
backend with configuration, logging, and a database layer that works on both
SQLite (local) and Postgres (production) — no business logic yet.

## Layout

```
backend/    FastAPI app, config, logging, database layer
frontend/   (later phase)
docs/       (later phase)
```

## Backend — running locally

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Then:

```bash
curl localhost:8000/health   # -> {"status":"ok"}
```

Starting the app creates `backend/dossi.db` (SQLite) with the `user`, `session`,
and `message` tables. To run against Postgres instead, point `DATABASE_URL` at a
Postgres/Neon URL in `.env` — no code change required:

```
DATABASE_URL=postgresql+psycopg://user:pass@host/dbname?sslmode=require
```
