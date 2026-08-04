# QuantLab

**Version:** `1.0.0`

QuantLab is a quantitative trading **research** platform for strategy development, event-driven backtesting, parameter optimization, and Strategy Library management. Results are historical research aids — not investment advice.

## Main features

- **New Research / Random Search** — explore parameter combinations (temporary computation)
- **Strategy workspace** — Overview, Optimization Summary, Winning Parameters, Trade Replay, Equity Curve, AI Analysis, Version History
- **Strategy Library** — save, browse, open, and delete strategies
- **Strategy Lab / Backtest Lab** — run Moving Average Cross backtests on live Binance markets
- **Market Explorer** — import and inspect historical candle data
- **Strategy Compare** — compare a baseline backtest with an optimized candidate
- **Dashboard** — KPIs, equity curve, trade history, and restore after refresh
- **Mobile-ready shell** — drawer navigation below desktop breakpoints

## Current workflow

```text
New Research → Random Search → Optimization Summary → Trade Replay Validation → Save Strategy → Strategy Library
```

1. **New Research** — configure market / period / ranges and start Random Search  
2. **Optimization Summary** — review the resulting Strategy draft (search itself is temporary)  
3. **Trade Replay** — validate winning parameters bar-by-bar  
4. **Save Strategy** — promote the draft into the Strategy Library  
5. **Strategy Library** — reopen Overview, equity, AI analysis, and version history anytime 

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

1. Open http://localhost:5173/optimizer (**New Research**)  
2. Run **Random Search**  
3. Review **Optimization Summary** on the Strategy workspace  
4. Validate with **Trade Replay**, then **Save Strategy**  
5. Browse the **Strategy Library** at `/strategies`

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
- **Slim research archives** — durable strategy data reuses research-session storage (`quantlab.research-sessions.v1`) for summaries; full candle / equity / trade series live in the backtest detail / replay stores  
- **Not implemented in v1.0.0** — Reports, Settings configuration UI, and advanced validation workflows (nav items marked **Soon**)  
- **Persistence origin** — always test restore on `https://quantlab-frontend.vercel.app`; switching ephemeral deployment URLs looks like “lost” data even though it remains under the previous origin  

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
