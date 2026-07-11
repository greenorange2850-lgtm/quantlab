# AI Trading Research OS — Architecture

> Institutional-grade quantitative research platform. Research only — no live trading.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER (React 19)                   │
│  Dashboard │ Strategy Lab │ Backtest Lab │ Market Explorer │ ...   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTP /api/v1
┌──────────────────────────────▼──────────────────────────────────────┐
│                      APPLICATION LAYER (Express)                    │
│  Routes → Services → Engine Orchestration → Repositories           │
└──────┬──────────┬──────────┬──────────┬──────────┬─────────────────┘
       │          │          │          │          │
┌──────▼───┐ ┌───▼────┐ ┌───▼────┐ ┌──▼─────┐ ┌──▼──────┐ ┌────────┐
│ Research │ │Backtest│ │Strategy│ │   AI   │ │Knowledge│ │Optimizer│
│  Engine  │ │ Engine │ │ Engine │ │ Engine │ │ Engine  │ │ Engine  │
└──────┬───┘ └───┬────┘ └───┬────┘ └──┬─────┘ └──┬──────┘ └──┬─────┘
       │          │          │         │          │           │
┌──────▼──────────▼──────────▼─────────▼──────────▼───────────▼─────┐
│                      DATABASE LAYER (SQLite)                        │
│  market_data │ strategies │ backtests │ trades │ knowledge │ ...  │
└─────────────────────────────────────────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  AI Python Service  │  (Future — LLM analysis)
                    └─────────────────────┘
```

## Monorepo Structure

```
ai-trading-research-os/
├── src/                          # Presentation Layer (React)
│   ├── api/                      # API client + TanStack Query hooks
│   ├── components/ui/            # Reusable UI primitives
│   ├── features/                 # Feature-specific UI modules
│   ├── layouts/                  # App shell (sidebar, topnav)
│   ├── pages/                    # Route pages
│   ├── stores/                   # Zustand global state
│   ├── hooks/                    # Custom React hooks
│   ├── providers/                # Context providers
│   ├── mock/                     # Fallback mock data
│   └── types/                    # Re-exports from @trading-os/shared
│
├── server/                       # Application Layer (Express API)
│   └── src/
│       ├── routes/               # REST endpoints per domain
│       ├── services/             # Business orchestration
│       ├── middleware/           # Error handling, response helpers
│       └── config.ts
│
├── packages/
│   ├── shared/                   # Domain types + API contracts
│   ├── database/                 # SQLite schema, migrations, repos
│   └── engines/                  # Core computation engines
│
├── services/
│   └── ai-python/                # Future Python AI microservice
│
└── data/                         # SQLite database (gitignored)
```

## Layer Responsibilities

| Layer | Responsibility | Must NOT do |
|-------|---------------|-------------|
| **Presentation** | UI rendering, user interaction, state display | Business logic, DB access |
| **Application** | HTTP routing, request validation, orchestration | UI rendering, raw SQL |
| **Engines** | Computation, analysis, backtesting | HTTP handling, UI |
| **Database** | Persistence, queries, migrations | Business rules |
| **Shared** | Types, contracts, constants | Any runtime logic |

## Engine Modules

### Research Engine
Detects market structure patterns from candle data.
- CRT, Liquidity Sweep, FVG, MSS, BOS, Order Block, Equal Highs/Lows
- Session detection, trend analysis, multi-timeframe context
- **Status:** Interface + stub. Pattern detectors to be implemented per-pattern.

### Backtest Engine
Historical strategy testing with full statistics.
- Trade simulation, equity curve, drawdown calculation
- Version comparison, trade replay (async generator)
- Metrics: Win Rate, PF, Sharpe, Recovery Factor, streaks
- **Status:** Interface + metrics calculator. Simulation logic pending.

### Strategy Engine
Immutable version-controlled strategy management.
- CRT v1 → v2 → v3 with rules, filters, metrics, AI notes
- Version lineage, diff between versions
- **Status:** Interface + stub. Repository integration pending.

### AI Analysis Engine
Analyzes existing strategies — never invents from scratch.
- Weakness discovery, measurable improvement recommendations
- Proposes new strategy versions based on evidence
- **Status:** Interface + stub. Python LLM service planned.

### Knowledge Engine
Learns from every completed backtest.
- Stores successful/failed conditions, best sessions, filters, timeframes
- Queryable insights that improve over time
- **Status:** Interface + stub. Extraction logic pending.

### Optimization Engine
Parameter sweep and walk-forward analysis.
- **Status:** Interface + stub.

## Database Schema

17 tables across 6 modules:

| Module | Tables |
|--------|--------|
| Market Data | `symbols`, `timeframes`, `sessions`, `candles` |
| Pattern Events | `crt_events`, `fvg_events`, `liquidity_events`, `mss_events` |
| Strategies | `strategies`, `strategy_versions` |
| Backtests | `backtests`, `trades` |
| Intelligence | `optimization_history`, `ai_analysis`, `knowledge_base` |
| System | `reports`, `settings`, `_migrations` |

## API Endpoints

```
GET  /api/v1/health
GET  /api/v1/dashboard
GET  /api/v1/strategies
GET  /api/v1/strategies/:id
GET  /api/v1/strategies/:id/versions
GET  /api/v1/backtests
GET  /api/v1/backtests/:id
GET  /api/v1/backtests/:id/trades
POST /api/v1/backtests/run
GET  /api/v1/market-data/symbols
POST /api/v1/market-data/import
POST /api/v1/ai/analyze
GET  /api/v1/knowledge
POST /api/v1/optimization/run
```

## Version System

Every strategy change creates an immutable version:

```
Momentum Breakout
├── v3.0.5  (parent: v3.0.4)  — Initial session filter
├── v3.1.0  (parent: v3.0.5)  — Added HTF bias
├── v3.2.0  (parent: v3.1.0)  — FVG confirmation
└── v3.2.1  (parent: v3.2.0)  — London session only ← current
```

Each version stores: `rules`, `filters`, `metrics`, `aiNotes`, `changelog`, `parentVersionId`.

## Build Order (Module Roadmap)

Modules are built independently and testable:

1. ✅ **Architecture** — Monorepo, types, schema, engine interfaces, API skeleton
2. ✅ **Market Data** — CSV/MT/SQLite/Dukascopy import, candle storage, Market Explorer UI
3. 🔲 **Research Engine** — Pattern detectors, one per pattern type
4. 🔲 **Strategy Lab** — CRUD UI + version management
5. 🔲 **Backtest Engine** — Trade simulation + statistics
6. 🔲 **Backtest Lab** — Run UI, results, comparison
7. 🔲 **Trade Replay** — Chronological trade playback
8. 🔲 **AI Analysis** — Python service + weakness detection
9. 🔲 **Knowledge Engine** — Backtest learning extraction
10. 🔲 **Optimizer** — Parameter sweep UI + engine
11. 🔲 **Reports** — PDF/CSV export generation

## Development

```bash
# Install all dependencies
npm install

# Run database migrations + seed
npm run db:migrate
npm run db:seed

# Start frontend + API concurrently
npm run dev

# Build everything
npm run build
```

Frontend: `http://localhost:5173`
API: `http://localhost:3001/api/v1`

## Design Principles

- **SOLID** — Single responsibility per module, interface-driven engines
- **No business logic in UI** — Components render, hooks fetch, stores hold state
- **No duplication** — Shared types in `@trading-os/shared`, used by frontend + backend
- **Version everything** — Strategies, backtests, AI analyses are immutable records
- **Measurable AI** — Every AI recommendation must cite evidence and expected improvement
- **Research only** — Platform never executes live trades
