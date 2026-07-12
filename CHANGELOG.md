# Changelog

All notable changes to QUANTLAB are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.2.0-alpha.1]: https://github.com/quantlab/quantlab/releases/tag/v0.2.0-alpha.1
