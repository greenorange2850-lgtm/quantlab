# QUANTLAB Architecture

QUANTLAB is a TypeScript monorepo for quantitative trading research. Business logic lives in `src/core/`; the React dashboard in `src/` is a thin presentation layer.

## System Diagram

```
                         ┌─────────────────────────────────────┐
                         │           React Dashboard           │
                         │  (presentational components only)   │
                         └──────────────────┬──────────────────┘
                                            │
                                   DashboardViewModel
                                            │
┌──────────────┐    ┌──────────────┐    ┌───┴────────┐    ┌──────────────┐
│    Market    │───▶│   Strategy   │───▶│    Risk    │───▶│  Execution   │
│  Data Engine │    │    Engine    │    │   Engine   │    │    Engine    │
└──────────────┘    └──────────────┘    └────────────┘    └──────┬───────┘
       │                                                            │
       │ HistoricalFeed / ReplayFeed / LiveFeed                     │ Fill
       │                                                            ▼
       │                                                   ┌──────────────┐
       │                                                   │  Portfolio   │
       │                                                   │    Engine    │
       │                                                   └──────┬───────┘
       │                                                          │
       │                                                          ▼
       │                                                   ┌──────────────┐
       └──────────────────────────────────────────────────▶│  Analytics   │
                                                           │    Engine    │
                                                           └──────────────┘
```

## Data Flow (Backtest)

```
MarketDataEngine
    └── HistoricalFeed.loadHistorical()
            └── Candle[]
                    └── BacktestEngine.runWithHistoricalFeed()
                            ├── Strategy.evaluate() → Signal
                            ├── OrderRequest (sizing)
                            ├── ExecutionEngine.executeOrder() → Fill
                            ├── Portfolio.applyFill()
                            └── BacktestResult
                                    └── buildBacktestReport() → BacktestReport
                                            └── buildDashboardViewModel() → DashboardData
                                                    └── React components render
```

## Layer Responsibilities

### Market (`src/core/market/`)

Coordinates all candle data access. Feeds emit typed events (`BarOpened`, `BarClosed`, `ReplayStarted`, etc.).

| Component | Role |
|-----------|------|
| `MarketDataEngine` | Feed factory, active feed tracking, event bus |
| `HistoricalFeed` | Load candles for backtesting (symbol, timeframe, date range) |
| `ReplayFeed` | Bar-by-bar replay with play/pause/step/seek/speed |
| `LiveFeed` | Interface stub for future exchange adapters |

**Rule:** Dashboard and React code never import `src/data/providers/` directly. All data flows through `MarketDataEngine`.

### Strategy (`src/core/strategy/`, `src/core/signals/`, `src/core/indicators/`)

Maps candle history to trading signals. Strategies are pure functions over `Candle[]`.

| Component | Role |
|-----------|------|
| `Strategy` | Interface: `evaluate(candles, symbol) → Signal` |
| `MovingAverageCrossStrategy` | Reference EMA-cross + RSI strategy |
| Indicators | SMA, EMA, RSI (pure math, no side effects) |
| Signals | Typed `BUY` / `SELL` / `HOLD` with confidence and reason |

### Risk (`src/core/risk/`, `src/core/models/`)

Position sizing and exposure limits. Domain types for accounts, orders, positions, and trades.

| Component | Role |
|-----------|------|
| `RiskConfig` | Risk limits (per-trade %, max drawdown, etc.) |
| `calculatePositionSize()` | Fixed-fractional sizing from stop distance |
| Domain models | Shared types for all trading modes |

### Execution (`src/core/execution/`)

Simulates order routing, fills, commission, and slippage. Shared by backtest, paper, and live modes.

| Component | Role |
|-----------|------|
| `executeOrder()` | Validate, apply slippage/commission, generate fills |
| `OrderManager` | Track pending, filled, cancelled, rejected orders |
| `Fill` | Atomic unit of portfolio mutation |

### Portfolio (`src/core/portfolio/`)

Mark-to-market portfolio state derived from fills.

| Component | Role |
|-----------|------|
| `calculatePortfolioValue()` | Equity from cash + positions |
| `calculateExposure()` | Gross market exposure |
| `calculateAllocation()` | Position weights |
| `calculatePortfolioPnL()` | Realized and unrealized PnL |

Backtest `Portfolio` class (`src/core/backtest/Portfolio.ts`) applies fills and records closed trades.

### Analytics (`src/core/analytics/`)

Post-simulation analysis. Never imports execution or market code.

| Component | Role |
|-----------|------|
| `buildBacktestReport()` | `BacktestResult` → `BacktestReport` |
| Drawdown / monthly returns / trade analyzer | Pure metric functions |
| Export | CSV and JSON report generation |

### Dashboard (`src/core/dashboard/`, `src/features/dashboard/`)

Presentation only. `DashboardViewModel` maps `BacktestReport` to `DashboardData`. React components receive pre-computed metrics.

| Component | Role |
|-----------|------|
| `buildDashboardViewModel()` | Analytics → UI-ready data |
| `runBacktestPipeline()` | End-to-end backtest orchestration |
| `useBacktestStore` | Client-side state for dashboard refresh |
| Feature components | KPI cards, equity curve, trade table, portfolio panel |

## Why Business Logic Never Lives in React

1. **Testability** — Core engines run in Vitest without a DOM or browser APIs.
2. **Reusability** — The same pipeline powers CLI demos (`npm run demo:backtest`), the Strategy Lab UI, and future server-side jobs.
3. **Consistency** — Win rate, drawdown, and PnL are computed once in analytics; the UI cannot drift from engine output.
4. **Mode parity** — Backtest, paper, and live trading share execution, portfolio, and analytics code. Only the market feed changes.
5. **Separation of concerns** — React handles rendering, animation, and user input. `src/core/` handles trading semantics.

## Repository Layout

```
src/
├── core/           # All business logic (pure TypeScript)
│   ├── market/     # Market data engine
│   ├── strategy/   # Strategy framework
│   ├── signals/    # Signal types
│   ├── indicators/ # Technical indicators
│   ├── risk/       # Risk config and sizing
│   ├── execution/  # Order execution and fills
│   ├── portfolio/  # Portfolio analytics
│   ├── backtest/   # Event-driven simulation
│   ├── analytics/  # Post-backtest reports
│   ├── dashboard/  # View model and pipeline
│   └── models/     # Domain types
├── data/           # Exchange adapters (Binance, mock provider)
├── features/       # React feature components
├── pages/          # Route pages
└── stores/         # Client state (Zustand)

packages/           # Shared workspace packages
server/             # Express API
docs/               # Module docs and ADRs
```

## Further Reading

- [Strategy Engine](docs/strategy-engine.md)
- [Backtesting](docs/backtesting.md)
- [Analytics](docs/analytics.md)
- [Market Data](docs/market-data.md)
- [ADRs](docs/adr/)
