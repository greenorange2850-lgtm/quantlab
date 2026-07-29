# Railway — QUANTLAB API backend

Deploy the Express API (`@trading-os/api`) on [Railway](https://railway.app). This service is **backend only** — do not serve the Vite frontend from this deployment.

## Prerequisites

- Node.js 20+
- A Railway account and a linked GitHub repository
- A separate frontend host (e.g. Vercel) with `VITE_API_BASE_URL` pointing at this API’s public URL + `/api/v1`

## Railway setup

1. Create a new Railway project → **Deploy from GitHub** → select this repository.
2. Add a service from the repo root (monorepo).
3. Configure the service:

| Setting | Value |
|---------|--------|
| Root Directory | `/` (repository root) |
| Build Command | `npm ci && npm run build:server` |
| Start Command | `npm start` |
| Healthcheck Path | `/health` |

`npm start` runs `node dist/index.js` in the `@trading-os/api` workspace after packages are built.

## Environment variables

Set these in the Railway service **Variables** panel:

| Variable | Required | Example | Notes |
|----------|----------|---------|--------|
| `NODE_ENV` | Yes | `production` | Enables production CORS rules |
| `PORT` | No* | *(Railway sets automatically)* | App reads `PORT`; Railway injects it |
| `HOST` | No | `0.0.0.0` | Default binds all interfaces |
| `DATABASE_PATH` | Yes (with volume) | `/data/trading-os.db` | Absolute path on the mounted volume |
| `CORS_ORIGIN` | Yes in production | `https://your-app.vercel.app` | Comma-separated list allowed; no wildcards |

Optional / unused by Railway health:

| Variable | Notes |
|----------|--------|
| `AI_SERVICE_URL` | Existing optional AI sidecar URL (local default `http://localhost:8000`) |

Local defaults (when unset, non-production):

- `PORT=3001`
- `HOST=0.0.0.0`
- `DATABASE_PATH` → `data/trading-os.db` under the process working directory
- CORS allows localhost / `127.0.0.1` (any port) plus optional `CORS_ORIGIN`

Copy names from `server/.env.example`.

## Persistent volume (SQLite)

SQLite writes a file on disk. Railway’s ephemeral filesystem **will lose data** on redeploy unless you attach a volume.

1. In the Railway service → **Volumes** → add a volume.
2. Mount it at `/data` (or another path you prefer).
3. Set `DATABASE_PATH=/data/trading-os.db`.

The API creates the parent directory if it is missing. Keep the volume mounted across deploys so migrations and stored backtests persist.

> **Note:** `better-sqlite3` is a native addon. Railway/Nixpacks builds it during `npm ci` for the service architecture. Prefer Linux x64 builders; avoid swapping OS mid-flight without a clean install.

## Deployment steps

1. Merge the Railway backend changes to your deploy branch.
2. Create/connect the Railway service as above.
3. Attach the volume and set environment variables.
4. Deploy. Confirm health:

   ```bash
   curl -s https://<your-railway-domain>/health
   ```

   Expected shape:

   ```json
   {
     "status": "ok",
     "timestamp": "<ISO-8601>",
     "version": "0.2.0-alpha.1"
   }
   ```

5. Confirm the existing API health (unchanged contract):

   ```bash
   curl -s https://<your-railway-domain>/api/v1/health
   ```

6. Point the frontend at the API:

   ```text
   VITE_API_BASE_URL=https://<your-railway-domain>/api/v1
   ```

7. Ensure `CORS_ORIGIN` matches the exact frontend origin (scheme + host, no trailing slash).

## Local production smoke

```bash
npm ci
npm run build:server
NODE_ENV=production \
  CORS_ORIGIN=http://localhost:5173 \
  DATABASE_PATH=./data/trading-os.db \
  PORT=3001 \
  npm start
```

Then open `http://localhost:3001/health`.

## Out of scope

- Frontend / Vercel configuration
- Schema migrations beyond what the app already runs on boot
- Replacing SQLite with a managed SQL service
