# ADR 0003: Research Analytics Separation

## Status

Accepted

## Context

QuantLab's backtest engine simulates order execution, portfolio state, and basic statistics. Research workflows also need richer analytics: enriched equity curves, drawdown episodes, monthly returns, trade-level metrics, and exportable reports.

Mixing these concerns into `BacktestEngine` would bloat the execution path and make testing harder.

## Decision

Create a separate `src/core/analytics/` module that:

- Accepts `BacktestResult` as input
- Produces `BacktestReport` and export artifacts
- Uses pure functions for all derived calculations
- Never imports exchange providers or execution logic

The engine records minimal per-bar state (`equity`, `cash`). Analytics enriches and aggregates offline.

## Consequences

**Positive**

- Execution engine stays focused and stable.
- Analytics can evolve (new charts, metrics, formats) without touching simulation code.
- Pure functions are easy to unit test with fixtures.
- Same analytics apply to results from live paper trading later.

**Negative**

- Consumers needing full reports must call both engine and `buildBacktestReport()`.
- Minor extension to `EquityPoint` (adding `cash`) required in the engine for accurate curve data.

## Alternatives considered

1. **Embed all analytics in BacktestEngine** — rejected; violates single responsibility and increases regression risk.
2. **External analytics library** — rejected; dependency-free constraint and less control over report shape.
