# Deploy frontend to Vercel

The Vite React dashboard lives at the **repository root** (`index.html`, `src/`, `vite.config.ts`, root `package.json`). Deploy it from `.` — never set Root Directory to `server/`.

`server/` is the Express API and is hosted separately (for example on Railway). It is not part of the Vercel frontend project.

## Required Vercel project settings

| Setting | Value |
|---------|--------|
| Framework | Vite |
| Root Directory | `.` (repository root) |
| Build Command | `npm run build:web` |
| Output Directory | `dist` |
| Install Command | `npm ci` (or Vercel default) |
| Node.js | 20+ |

These settings are also encoded in [`vercel.json`](../../vercel.json) at the repo root so GitHub → Vercel imports pick them up automatically.

## Why Root Directory must be `.`

| Path | Role | Deploy target |
|------|------|---------------|
| `/` (`index.html`, `src/`, `vite.config.ts`) | Vite SPA | **Vercel** |
| `/server` | Express API (`@trading-os/api`) | Not Vercel |
| `/packages` | Shared libraries (source-aliased into the Vite build) | Built via Vite aliases |

Nothing in this repository requires `Root Directory = server` for the frontend. Pointing Vercel at `server/` will fail: there is no Vite app there, only an Express TypeScript package.

## SPA routing

`vercel.json` includes a rewrite so client-side routes keep working on refresh and deep links:

```json
{ "source": "/(.*)", "destination": "/index.html" }
```

Vercel still serves real static files under `dist/` (for example `/assets/*`) before the rewrite applies.

## Deployment checklist

Use this when connecting the GitHub repo to a new Vercel project (or fixing a misconfigured one).

### Project setup

- [ ] Create a Vercel project linked to this GitHub repository
- [ ] Confirm **Root Directory** is `.` (blank / repository root) — **not** `server`
- [ ] Confirm **Framework Preset** is **Vite**
- [ ] Confirm **Build Command** is `npm run build:web`
- [ ] Confirm **Output Directory** is `dist`
- [ ] Confirm Node.js is **20** or later (Project → Settings → General)

### Build verification

- [ ] Local: `npm run build:web` succeeds and writes to `dist/`
- [ ] Trigger a Vercel deployment from `main` (or this branch)
- [ ] Build log shows `vite build` (via `build:web`), not a server/`tsc` API build
- [ ] Deployment output is the SPA under `dist/`, not `server/dist`

### Runtime / routing

- [ ] Open the **stable** production URL — dashboard loads
- [ ] Hard-refresh a deep route (e.g. `/strategy-lab`) — still returns the SPA (rewrite works)
- [ ] Static assets under `/assets/` load (200), not rewritten to `index.html`

### Research session persistence (localStorage + origins)

Browsers scope `localStorage` **per origin** (`scheme + host + port`). The research archive key is `quantlab.research-sessions.v1`.

Vercel issues a **new host for every deployment**, including many “Production” deployment status URLs reported to GitHub, for example:

- Ephemeral: `https://quantlab-frontend-<deploymentId>-greenorange.vercel.app`
- Stable alias: `https://quantlab-frontend.vercel.app`

If you create sessions on an ephemeral deployment URL, then later open a different deployment URL (or the stable alias), the sessions are **not deleted** — they are simply stored under the previous origin and invisible on the new one.

**Always test persistence on the stable URL:**

```text
https://quantlab-frontend.vercel.app
```

Dev / Vercel builds show a temporary “Persist diagnostics” panel (origin, key, hydrate status, counts, payload size, last write error) and log the same snapshot to the console as `[quantlab:persist-diag]`. Force it with `?persistDiag=1`.

### API (separate from Vercel)

- [ ] Backend is deployed elsewhere if the dashboard needs live API data
- [ ] CORS on the API allows the Vercel origin
- [ ] Do **not** try to run the Express API from this Vercel project

### Misconfiguration red flags

| Symptom | Likely cause |
|---------|----------------|
| Build looks for `server/package.json` as the app | Root Directory set to `server` |
| Output / start expects Node Express | Framework not Vite, or wrong root |
| Deep links 404 on refresh | Missing SPA rewrite in `vercel.json` |
| Build runs full monorepo `npm run build` (API + packages) | Build Command not set to `npm run build:web` |

## Local commands

```bash
# Frontend production build (same as Vercel)
npm run build:web

# Preview locally
npm run preview
```

## Related docs

- [README — Deployment](../../README.md#deployment-vercel-frontend)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
