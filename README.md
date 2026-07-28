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

# Build for production
npm run build
```

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

## Deploy

### Production (API + dashboard together)

```bash
npm ci
npm run build
CORS_ORIGIN=* npm start
```

The API serves the built web UI from `dist/` and listens on `PORT` (default `3001`).

### Docker / Render

```bash
docker build -t quantlab .
docker run --rm -p 3001:3001 quantlab
```

Or connect this repo to [Render](https://render.com) — `render.yaml` is included.

### GitHub Pages (frontend only)

Pushing to `main` deploys the dashboard to GitHub Pages. Strategy Lab works client-side; API-backed pages need the full-stack deploy above.

Site URL: `https://greenorange2850-lgtm.github.io/quantlab/`

## License

Private — all rights reserved.
