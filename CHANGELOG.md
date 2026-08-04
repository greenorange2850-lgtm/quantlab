# Changelog

All notable changes to QuantLab are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

#### Strategy workflow audit
- Random Search now persists replay payloads (candles + trades) for winning candidates and marks Open Replay available immediately
- Dashboard restores the **active Strategy** winning backtest instead of an arbitrary latest Research Session / detail
- Save Strategy updates list + detail query caches immediately (Draft → Saved) without a refresh
- Compare / Optimizer deep links prefer `?strategy=` (legacy `?session=` still works)
- Auto-restore no longer hydrates an unrelated latest research session into the research store

### Changed

#### Strategy-first UX
- Primary object is now a **Strategy**; Research Sessions remain an internal persistence detail
- Nav: **New Research** (`/optimizer`) and **Strategy Library** (`/strategies`) replace Research Sessions / Research Analysis entries
- Workflow: New Research → Random Search → Optimization Summary → Trade Replay → Save Strategy → Library
- Strategy workspace tabs: Overview, Optimization Summary, Winning Parameters, Trade Replay, Equity Curve, AI Analysis, Version History
- Completed Random Search navigates to the Strategy draft (`/strategies/:id?tab=optimization`)
- Legacy routes `/research-sessions` and `/research-analysis` redirect to Strategy Library / workspace
- Strategy metadata overlay (`quantlab.strategy-metadata.v1`) for name / saved state; research archive key unchanged
- Dashboard restore badge copy: “Strategy restored”

## [1.0.0] - 2026-07-29

First production-ready release of the QuantLab quantitative research workflow.

### Added

#### Backtesting
- Strategy Lab and Backtest Lab runners with live Binance symbol/timeframe selection
- Event-driven backtest pipeline (strategy → risk → execution → analytics → dashboard)
- Dashboard restore of historical backtest details without rerunning the pipeline

#### Live market data import
- Market Explorer for importing, validating, and browsing historical candle data
- Live Binance pair selector and candle loading for Strategy Lab / Optimizer runs

#### Random Search optimization
- Optimizer workspace for Moving Average Cross parameter random search
- Candidate table with Apply Parameters, View Details, Analysis, and Compare actions
- Research session persistence after completed searches

#### Research Analysis
- Dedicated Research Analysis workspace for archived `ResearchReport` presentation
- Overview, performance metrics, strengths/weaknesses, risk, and rating cards
- Deep links via `?session=<id>`

#### Strategy Compare
- Baseline backtest vs optimized candidate comparison
- Overview metrics, improvement summary, and what-changed list from existing reports
- Query params: `session`, `candidate`, `baseline`

#### Research Sessions
- Session list with filter, sort, Open Analysis, Compare, and Delete
- Shared archive source of truth for Optimizer, Analysis, Compare, and Sessions

#### Persistence and restore
- Research sessions persisted under `quantlab.research-sessions.v1`
- Slim durable payloads (summaries kept; heavy series trimmed for quota)
- Startup hydration gates so empty states do not flash before restore
- Latest backtest auto-restore after refresh
- Preview/dev diagnostics for origin-scoped localStorage on Vercel

#### Mobile responsiveness
- `lg` drawer navigation with backdrop, Escape close, and body scroll lock
- Responsive dashboard cards, tables, Strategy Lab / Market Explorer layouts

#### QA and production-readiness
- Hydration/empty-state fixes across Dashboard, Analysis, Compare, and Sessions
- Optimizer deep-link alignment (`session` with legacy `analysis` fallback)
- Honest Placeholder pages for Trade Replay, Reports, and Settings
- Planned nav badges for unimplemented routes

### Changed
- Root and workspace package versions bumped to `1.0.0`
- Branding title set to QuantLab

### Known Limitations
- Results are historical research, not investment advice
- Optimization is not out-of-sample validation
- Slim research archives omit full candle/equity/trade series (details remain in the backtest archive)
- Trade Replay, Reports, Settings, and advanced validation are not implemented
- Persistence testing must use the stable Vercel alias (`https://quantlab-frontend.vercel.app`) because `localStorage` is per-origin

## [0.2.0-alpha.1] - 2026-07-12

First alpha release of the QUANTLAB quantitative research platform. This release establishes the core trading pipeline from market data through dashboard presentation.

### Added

#### Strategy Engine
- Pure signal framework (`BUY`, `SELL`, `HOLD`) with typed `Signal` output
- `Strategy` interface and `MovingAverageCrossStrategy` reference implementation
- Technical indicators: SMA, EMA, RSI
- Strategy evaluation without exchange coupling

#### Backtesting Engine
- Event-driven `BacktestEngine` with no-lookahead candle replay
- Signal execution at next-bar open
- `Portfolio` state management, commission modeling, and trade statistics
- `BacktestConfig` validation and `BacktestResult` output model

#### Analytics Engine
- `buildBacktestReport()` producing structured `BacktestReport`
- Equity curve enrichment, drawdown analysis, monthly returns
- Trade analyzer with profit factor, expectancy, and streak metrics
- CSV and JSON export utilities

#### Dashboard Integration
- `DashboardViewModel` mapping analytics output to presentation models
- Zustand-backed backtest store with Strategy Lab runner
- Live KPI cards, equity curve, trade history, and portfolio panel
- Empty states when no backtest has been executed

#### Risk Engine Foundation
- Trading domain models (`Account`, `Order`, `Position`, `Trade`)
- `RiskConfig` with validation defaults
- Fixed-fractional `calculatePositionSize()` calculator

#### Portfolio Engine
- Pure portfolio calculators: value, exposure, allocation, PnL
- `Portfolio` and `PositionSummary` models
- Buying-power rules for cash and margin accounts
- Dashboard portfolio snapshot integration

#### Execution Engine
- `OrderRequest`, `Fill`, and `ExecutionResult` models
- `executeOrder()` with commission, slippage, market and limit orders
- `OrderManager` lifecycle tracking (pending, filled, cancelled, rejected)
- Backtest engine routes all fills through execution before portfolio updates

#### Market Data Engine
- `MarketDataEngine` coordinating historical, replay, and live feeds
- `HistoricalFeed` with date-range filtering for backtesting
- `ReplayFeed` with play, pause, step, seek, and speed controls
- `LiveFeed` interface stub for future venue adapters
- Strongly typed market and replay events

#### Documentation
- Architecture guide, roadmap, and ADRs for core design decisions
- Module docs for strategy, backtesting, analytics, and market data

### Changed
- Dashboard no longer uses mock data; metrics flow from the real backtest pipeline
- Backtest pipeline loads candles through `MarketDataEngine` instead of direct provider access
- Root package version bumped to `0.2.0-alpha.1`

### Known Limitations (Alpha)
- `LiveFeed` is an interface only; no live exchange connection
- Several UI routes remain placeholders (Backtest Lab, Trade Replay, Optimizer, etc.)
- Risk engine validates config but is not yet wired into position sizing during backtests
- Partial fills and stop orders are stubbed in the execution engine
- VWAP, MACD, Bollinger Bands, and ATR indicators are not yet implemented

[1.0.0]: https://github.com/greenorange2850-lgtm/quantlab/releases/tag/v1.0.0
[0.2.0-alpha.1]: https://github.com/greenorange2850-lgtm/quantlab/releases/tag/v0.2.0-alpha.1
