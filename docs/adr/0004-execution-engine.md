# ADR 0004: Shared Execution Engine

## Status

Accepted

## Context

The backtest `Portfolio` class originally opened and closed positions directly, baking commission and fill price logic into simulation code. Paper trading and live trading will need the same order validation, slippage, and fill semantics — but with different price sources.

Coupling fill logic to backtest-only code would require duplicating or rewriting execution rules for each trading mode.

## Decision

Create `src/core/execution/` with:

- `OrderRequest` — intent to buy or sell
- `Fill` — atomic execution result with price, quantity, commission, and slippage
- `ExecutionResult` — accepted/rejected outcome with fills
- `executeOrder()` — pure function applying validation, slippage, and commission
- `OrderManager` — lifecycle tracking (pending, filled, cancelled, rejected)

Refactor `BacktestEngine` to route all signals through `ExecutionEngine` before calling `Portfolio.applyFill()`. Portfolio mutates state only from fills, never from direct open/close calls.

## Consequences

**Positive**

- Single execution path for backtest, paper, and live modes.
- Commission and slippage rules are testable in isolation.
- Order lifecycle is observable through `OrderManager`.
- Natural extension point for limit orders, partial fills, and venue adapters.

**Negative**

- Additional indirection between signal and portfolio update.
- Order sizing remains in backtest layer until risk engine integration.

## Alternatives considered

1. **Keep portfolio open/close methods** — rejected; duplicates execution logic across modes.
2. **Third-party order simulator** — rejected; dependency-free constraint and less control over fill semantics.
