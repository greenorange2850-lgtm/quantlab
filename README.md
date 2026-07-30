# QuantLab

**Version:** `1.0.0`

QuantLab is a quantitative trading **research** platform for strategy development, event-driven backtesting, parameter optimization, and research session management. Results are historical research aids — not investment advice.

## Main features

- **Strategy Lab / Backtest Lab** — run Moving Average Cross backtests on live Binance markets
- **Market Explorer** — import and inspect historical candle data
- **Optimizer (Random Search)** — explore parameter combinations and score candidates
- **Research Analysis** — review archived research reports
- **Strategy Compare** — compare a baseline backtest with an optimized candidate
- **Research Sessions** — browse, open, compare, and delete archived research sessions
- **Dashboard** — KPIs, equity curve, trade history, and restore after refresh
- **Mobile-ready shell** — drawer navigation below desktop breakpoints

## Current workflow

```text
Strategy Lab → Backtest → Optimize → Analysis → Compare → Sessions
```

1. **Strategy Lab** — pick a Binance pair / timeframe and run a backtest  
2. **Dashboard** — review metrics (auto-restores the latest saved backtest after refresh)  
3. **Optimizer** — run Random Search to explore parameters  
4. **Research Analysis** — open the generated research report  
5. **Strategy Compare** — compare baseline vs optimized candidate  
6. **Research Sessions** — manage archived sessions (survives refresh on the same origin)

## Stable production URL

Use this alias for all persistence testing (localStorage is per-origin):

```text
https://quantlab-frontend.vercel.app
```

Do **not** rely on ephemeral Vercel deployment URLs from GitHub/Vercel status links (`quantlab-frontend-<id>-….vercel.app`) — each host has a separate `localStorage`.

## Local development

### Prerequisites

- **Node.js** 20 or later
- **npm** 10 or later

### Install

```bash
git clone https://github.com/greenorange2850-lgtm/quantlab.git
cd quantlab
npm install
```

### Run

```bash
# Web dashboard + API
npm run dev
```

| Service | URL |
|---------|-----|
| Dashboard | http://localhost:5173 |
| API | http://localhost:3001/api/v1 |

### Typical local path

1. Open http://localhost:5173/strategy-lab  
2. Select a live Binance symbol and timeframe  
3. Click **Run Backtest** — dashboard populates with pipeline metrics  
4. Open **Optimizer** → run Random Search  
5. Use **Research Analysis**, **Strategy Compare**, and **Research Sessions**

### Validation

```bash
npm test
npm run typecheck
npm run build:web
```

Optional package/API smoke (import → scan → analyze):

```bash
npm run build:packages
npm run smoke
```

## Deployment

Frontend deploys from the repository root to Vercel (`npm run build:web` → `dist/`).  
See [docs/deployment/vercel.md](docs/deployment/vercel.md).

The Express API (`server/`) is hosted separately (for example Railway). See [docs/deployment/railway.md](docs/deployment/railway.md).

## Known limitations

- **Not investment advice** — all results are historical research only  
- **Optimization ≠ validation** — Random Search scores in-sample candidates; it does not prove out-of-sample robustness  
- **Slim research archives** — durable research sessions store summaries (and equity endpoints); full candle / equity / trade series are not kept in `quantlab.research-sessions.v1` (candidate details use the backtest detail archive)  
- **Not implemented in v1.0.0** — Trade Replay, Reports, Settings configuration UI, and advanced validation workflows (nav items marked **Soon**)  
- **Persistence origin** — always test restore on `https://quantlab-frontend.vercel.app`; switching ephemeral deployment URLs looks like “lost” sessions even though data remains under the previous origin  

## Project structure

```
src/core/       Business logic (strategy, backtest, execution, analytics, research, …)
src/features/   React feature workspaces
src/pages/      Route pages
src/data/       Exchange data adapters
packages/       Shared workspace libraries
server/         Express API
docs/           Module documentation and ADRs
```

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture |
| [CHANGELOG.md](CHANGELOG.md) | Release history |
| [ROADMAP.md](ROADMAP.md) | Planned features |
| [docs/deployment/vercel.md](docs/deployment/vercel.md) | Vercel frontend checklist |
| [docs/deployment/railway.md](docs/deployment/railway.md) | Railway API checklist |
| [docs/adr/](docs/adr/) | Architecture decision records |

## License

Private — all rights reserved.
