# QUANTLAB

Quantitative trading research platform — strategy development, event-driven backtesting, analytics, and a live dashboard.

**Version:** `0.2.0-alpha.1`

## Overview

QUANTLAB is a TypeScript monorepo with a pure core engine and a React dashboard. All trading logic lives in `src/core/`; the UI is presentational only.

```
Market → Strategy → Risk → Execution → Portfolio → Analytics → Dashboard
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full system design.

## Prerequisites

- **Node.js** 20 or later
- **npm** 10 or later

## Install

```bash
git clone <repository-url>
cd chart
npm install
```

## Development

Start the web dashboard and API server concurrently:

```bash
npm run dev
```

| Service | URL |
|---------|-----|
| Dashboard | http://localhost:5173 |
| API | http://localhost:3001/api/v1 |

### Open the dashboard

1. Run `npm run dev`
2. Open http://localhost:5173
3. Navigate to **Strategy Lab** (`/strategy-lab`)
4. Click **Run Backtest** — the dashboard populates automatically with real metrics

## Run Tests

```bash
# Run all tests once
npm run test

# Watch mode
npm run test:watch
```

## Run Backtests

### Via the dashboard (recommended)

1. `npm run dev`
2. Open http://localhost:5173/strategy-lab
3. Configure symbol, interval, and capital
4. Click **Run Backtest**

### Via CLI demos

```bash
# Event-driven backtest with Binance data
npm run demo:backtest

# Full analytics report from a backtest
npm run demo:analytics

# Strategy signal evaluation
npm run demo:strategy

# Indicator calculations
npm run demo:indicators
```

## Validation

```bash
# TypeScript type checking (all packages + app + API)
npm run typecheck

# Lint
npm run lint

# Full monorepo production build (packages + API + web)
npm run build

# Frontend-only production build (Vite → dist/) — used by Vercel
npm run build:web
```

## Deployment (Vercel frontend)

The Vite dashboard is deployed from the **repository root**. Do not set Vercel Root Directory to `server/` — that package is the Express API and is hosted separately.

| Setting | Value |
|---------|--------|
| Framework | Vite |
| Root Directory | `.` |
| Build Command | `npm run build:web` |
| Output Directory | `dist` |

`vercel.json` at the repo root encodes the same build settings and an SPA rewrite so React Router deep links work on refresh.

See [docs/deployment/vercel.md](docs/deployment/vercel.md) for the full deployment checklist.

## Project Structure

```
src/core/       Business logic (strategy, backtest, execution, analytics, …)
src/features/   React dashboard components
src/pages/      Route pages
src/data/       Exchange data adapters
packages/       Shared workspace libraries
server/         Express API
docs/           Module documentation and ADRs
```

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture and layer responsibilities |
| [CHANGELOG.md](CHANGELOG.md) | Release history |
| [ROADMAP.md](ROADMAP.md) | Planned features |
| [docs/deployment/vercel.md](docs/deployment/vercel.md) | Vercel frontend deployment checklist |
| [docs/strategy-engine.md](docs/strategy-engine.md) | Strategy framework |
| [docs/backtesting.md](docs/backtesting.md) | Backtest engine |
| [docs/analytics.md](docs/analytics.md) | Analytics and reports |
| [docs/adr/](docs/adr/) | Architecture decision records |

## Alpha Limitations

This is an **alpha** release. Known gaps:

- Live trading feed is not connected (`LiveFeed` is interface-only)
- Several navigation routes are placeholders
- Risk engine validates config but does not yet size positions in backtests
- Stop orders and full partial-fill simulation are stubbed

See [ROADMAP.md](ROADMAP.md) for the path to v0.3 and beyond.

## License

Private — all rights reserved.
