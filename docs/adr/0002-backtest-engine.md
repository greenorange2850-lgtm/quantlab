# ADR 0002: Event-Driven Backtest Engine

## Status

Accepted

## Context

QuantLab has pure strategies that emit `Signal` objects and a provider abstraction for candle data. The next step is historical simulation: replay past prices, model entries/exits, track PnL, and compute performance statistics.

Two common approaches:

1. **Vectorized backtesting** — Compute all indicator columns upfront, derive trades with array operations.
2. **Event-driven simulation** — Walk candles sequentially, evaluate strategy per bar, execute with realistic timing constraints.

## Decision

Implement an **event-driven** `BacktestEngine` that:

- Iterates candles one-by-one
- Passes only historical slices to `Strategy.evaluate()`
- Executes signals at the **next candle open**
- Maintains portfolio state through a dedicated `Portfolio` class

## Consequences

**Positive**

- No lookahead bias — strategies cannot access future bars.
- Execution timing matches how live trading would receive fills (signal then next open).
- Same strategy code runs in backtest and live evaluation without modification.
- Natural extension point for risk checks, partial fills, and order types later.

**Negative**

- Slower than vectorized engines for very large datasets (acceptable for current scope).
- Per-bar strategy calls repeat indicator work (can be optimized later with caching inside strategies).

## Alternatives considered

1. **Vectorized pandas-style engine** — rejected; introduces lookahead risk and couples strategies to batch data shapes.
2. **External backtest library** — rejected; violates dependency-free constraint and reduces control over execution semantics.
