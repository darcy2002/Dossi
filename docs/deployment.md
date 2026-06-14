# Deployment (free tier)

Dossi deploys on three free services: **Neon** (Postgres), **Render** (backend +
frontend). Vercel is an equally easy alternative for the frontend. The repo
ships a `render.yaml` blueprint and a `frontend/vercel.json` so most of this is
copy-paste.

Total cost on free tiers: $0. The one caveat is Render free-tier cold starts
(see the bottom of this doc).

---

## 1. Database — Neon Postgres

1. Create a project at [neon.tech](https://neon.tech).
2. Copy the connection string from the dashboard. It looks like:
   ```
   postgresql://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
   ```
3. **Change the prefix to `postgresql+psycopg://`** so SQLAlchemy uses the
   psycopg3 driver that's in `requirements.txt`:
   ```
   postgresql+psycopg://user:pass@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
   ```
   This is the value you paste into `DATABASE_URL`. The app's engine uses it as
   is; the LangGraph checkpointer strips the `+psycopg` part internally.

You don't create any tables yourself. On first boot the backend runs
`create_db_and_tables()` (User/Session/Message) and the checkpointer's
`.setup()` (LangGraph checkpoint tables).

---

## 2. Backend — Render web service

**Option A — Blueprint (recommended):** In Render, **New > Blueprint**, pick this
repo. Render reads `render.yaml` and creates both services. Then fill in the
secret env vars it prompts for (everything marked `sync: false`).

**Option B — manual web service:**
- Root directory: `backend`
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Health check path: `/health`

### Backend environment variables

| Variable | Value |
|---|---|
| `LLM_PROVIDER` | `anthropic` |
| `LLM_MODEL` | `claude-sonnet-4-6` (Sonnet for live + demo runs) |
| `LLM_API_KEY` | your Anthropic key |
| `RESEARCH_PROVIDER` | `tavily` |
| `TAVILY_API_KEY` | your Tavily key |
| `FIRECRAWL_API_KEY` | only if `RESEARCH_PROVIDER=firecrawl` |
| `DATABASE_URL` | the Neon `postgresql+psycopg://...` string from step 1 |
| `JWT_SECRET` | any long random string |
| `JWT_EXPIRY_MINUTES` | `60` |
| `CORS_ORIGINS` | the frontend URL, e.g. `https://dossi-frontend.onrender.com` |

> Set `CORS_ORIGINS` after the frontend is deployed (step 3) and you know its
> URL. It accepts a comma-separated list if you have more than one origin.

---

## 3. Frontend — Render static site (or Vercel)

### Render (via the blueprint)
The `render.yaml` already defines `dossi-frontend` as a static site:
- Build: `npm ci && npm run build`
- Publish directory: `dist`
- SPA rewrite (`/* → /index.html`) so deep links like `/app/sessions/3` work.

Set its one env var: `VITE_API_URL` = the backend URL
(e.g. `https://dossi-backend.onrender.com`).

### Vercel (alternative)
Import the repo, set the root directory to `frontend`. `vercel.json` handles the
build, output directory, and SPA rewrite. Add the env var
`VITE_API_URL` = your backend URL. Deploy.

> `VITE_API_URL` is baked in at build time. If you change the backend URL later,
> redeploy the frontend.

---

## 4. Wire the two together

1. Deploy the backend, note its URL.
2. Deploy the frontend with `VITE_API_URL` = backend URL.
3. Set the backend's `CORS_ORIGINS` = frontend URL, redeploy the backend.
4. Open the frontend URL, sign up, run a research session end to end.

---

## Production model

`LLM_MODEL` is `claude-sonnet-4-6` in production. Development used Haiku/Opus for
cost; Sonnet is the right balance of quality and price for the live and demo
runs. It's a single env var — no code change, no redeploy of the frontend.

---

## Free-tier cold start

Render free services spin down after ~15 minutes of inactivity. The next request
then pays a cold-start delay of 30–60 seconds while the service wakes. For a demo
this is the difference between an instant load and an awkward wait.

A small uptime pinger keeps it warm. This repo ships
`.github/workflows/keepalive.yml`, a GitHub Action that pings `/health` every 10
minutes. To enable it, add a repo secret `BACKEND_URL` = your backend URL
(Settings > Secrets and variables > Actions). Without the secret it no-ops.

Alternatives: a free monitor at [cron-job.org](https://cron-job.org) or
[uptimerobot.com](https://uptimerobot.com) pointed at `<backend>/health` does the
same thing and tends to fire more reliably than GitHub's scheduler. Before a
demo, just load the app once a few minutes early to guarantee it's warm.
