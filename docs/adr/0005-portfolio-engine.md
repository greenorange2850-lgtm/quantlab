# ADR 0005: Portfolio Engine

## Status

Accepted

## Context

Portfolio metrics (equity, exposure, allocation, PnL) were computed ad hoc in dashboard view-model code and embedded in the backtest `Portfolio` class. Paper trading and live trading need the same mark-to-market calculations without duplicating formulas in React or venue-specific code.

## Decision

Create `src/core/portfolio/` with pure functions:

- `calculatePortfolioValue()` — mark-to-market equity
- `calculateExposure()` — gross position exposure
- `calculateAllocation()` — position weights
- `calculatePortfolioPnL()` — realized and unrealized PnL
- `buildPortfolio()` — compose a full `Portfolio` snapshot

Define presentation-agnostic models (`Portfolio`, `PositionSummary`) separate from the backtest `Portfolio` class, which handles fill application and trade recording.

Map portfolio snapshots into `DashboardData` via `buildPortfolioFromBacktestBalances()` in the dashboard view model.

## Consequences

**Positive**

- Portfolio math is reusable across backtest, paper, and live modes.
- Dashboard receives pre-computed snapshots; React never calculates trading metrics.
- Pure functions are fully unit tested without simulation overhead.

**Negative**

- Two "portfolio" concepts exist: backtest state machine vs. analytics snapshot (named distinctly to avoid confusion).
- Open positions at backtest end require explicit position input for full accuracy.

## Alternatives considered

1. **Compute metrics in React** — rejected; violates separation of concerns and breaks testability.
2. **Embed all metrics in analytics module** — rejected; portfolio state is distinct from post-hoc report analysis.
