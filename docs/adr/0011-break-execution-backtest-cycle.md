# ADR 0011: Break Execution–Backtest Import Cycle

## Status

Accepted (analysis + removal plan; implementation deferred to a follow-up change)

## Context

ADR 0010 established `src/core/backtest/BacktestEngine` as the canonical simulator and required removing the compile-time dependency cycle between `src/core/execution` and `src/core/backtest` before any packaging moves.

This ADR records Migration Step 2: the exact cycle, the minimum symbols involved, compared options, and the safest smallest refactor. It does **not** authorize package moves, API renames, or a new architecture layer.

### Scope inspected

- `src/core/execution/**`
- `src/core/backtest/**`
- `trade-math` and its callers

---

## 1. Exact import graph creating the cycle

### Edges (production code only)

```text
execution/execution-engine.ts
 ──value──► backtest/trade-math.ts          (calculateCommission)
                 │
                 └──type──► backtest/Trade.ts (TradeDirection; only for calculatePnL)

backtest/BacktestEngine.ts
 ──value──► execution/execution-engine.ts   (ExecutionEngine)
 ──value──► execution/order-manager.ts      (OrderManager)
 ──type───► execution/execution-context.ts  (ExecutionContext)

backtest/order-sizing.ts
 ──value──► execution/execution-engine.ts   (estimateFillPrice)
 ──type───► execution/order-request.ts      (OrderRequest)

backtest/Portfolio.ts
 ──type───► execution/fill.ts               (Fill)
 ──value──► backtest/trade-math.ts          (calculatePnL, calculateTradeDuration)
```

### Cycle (module graph)

```text
┌────────────────────────────────────────────────────────────┐
│                                                            │
│   execution/execution-engine.ts                            │
│            │                                               │
│            │ import { calculateCommission }                │
│            ▼                                               │
│   backtest/trade-math.ts                                   │
│            ▲                                               │
│            │ used by Portfolio / re-exported by index      │
│   backtest/Portfolio.ts ◄── BacktestEngine / order-sizing  │
│            │                                               │
│            │ import ExecutionEngine, OrderManager,         │
│            │        estimateFillPrice, Fill, …             │
│            ▼                                               │
│   execution/*  ◄───────────────────────────────────────────┘
```

Simplified:

```text
execution ──► backtest/trade-math ──► (backtest graph) ──► execution
```

### What is *not* part of the cycle

| Module | Imports | Cycle? |
|--------|---------|--------|
| `order-manager.ts`, `fill.ts`, `order-request.ts`, `execution-result.ts`, `execution-context.ts` | Only `models` / sibling execution | No upward edge to backtest |
| `statistics.ts`, `BacktestConfig.ts`, `Trade.ts`, `Position.ts` | Backtest-local / risk | No edge to execution |
| PnL helpers in `trade-math` (`calculateLongPnL`, …) | Only `TradeDirection` | Not imported by execution |

---

## 2. Minimum set of functions/types causing the cycle

### The single upward edge (execution → backtest)

| Symbol | Kind | Defined in | Imported by |
|--------|------|------------|-------------|
| `calculateCommission(notional, commissionPercent)` | function | `backtest/trade-math.ts` | `execution/execution-engine.ts` (`buildFill`) |

**This is the only production import from `execution` into `backtest`.** Removing or relocating this one edge breaks the cycle.

### Downward edges (backtest → execution) — legitimate, keep

| Symbol | Used by | Role |
|--------|---------|------|
| `ExecutionEngine` / `executeOrder` | `BacktestEngine` | ADR 0004 fill path |
| `OrderManager` | `BacktestEngine` | Order lifecycle |
| `ExecutionContext` | `BacktestEngine` | Fill context |
| `estimateFillPrice` | `order-sizing.ts` | Risk sizing uses post-slippage price |
| `OrderRequest` | `order-sizing.ts` | Order intent |
| `Fill` | `Portfolio.ts` | Apply fills |

These edges are the intended layering (simulator depends on execution). They must stay.

### Rest of `trade-math.ts` (not causing the cycle)

| Function | Depends on | Callers |
|----------|------------|---------|
| `calculateLongPnL` / `calculateShortPnL` / `calculatePnL` | `TradeDirection` | `Portfolio` |
| `calculateTradeDuration` | none | `Portfolio` |
| `calculatePositionQuantity` | none | tests / legacy sizing |

---

## 3–9. Options, pure utility sufficiency, and recommendation

### Option A — Pure utility beside execution (recommended)

**Change (minimal):**

1. Add `src/core/execution/commission.ts` containing the current body of `calculateCommission`.
2. Point `execution-engine.ts` at `./commission.js` (stop importing `../backtest/trade-math.js`).
3. Keep `trade-math.ts` exporting `calculateCommission` by **re-exporting** from `../execution/commission.js` (or thin wrapper calling it) so:
   - `backtest/index.ts` still exports `calculateCommission`
   - `trade-math.test.ts` keeps importing from `../trade-math.js`
4. No public API renames; no test path changes required beyond green runs.

**Why a pure utility is sufficient**

- `calculateCommission` is a one-line pure function: `(notional * commissionPercent) / 100`.
- It has **no** dependency on backtest types (`Trade`, `Portfolio`, `BacktestConfig`).
- Its only runtime use in execution is fill construction; ADR 0004 already treats commission as an **execution** concern.
- Moving that single function below (or beside) execution removes the sole upward edge; no other trade-math symbols need to move.

**Preserves**

- Public APIs: `executeOrder`, `estimateFillPrice`, `ExecutionEngine`, `calculateCommission` from `@/core/backtest` / `trade-math`, all other trade-math exports.
- Tests: same import paths; same expected values (`10_000 @ 0.1% → 10`).
- Runtime: identical formula and call sites.

### Option B — Neutral folder under `src/core` (e.g. `src/core/math/commission.ts`)

Both `execution-engine` and `trade-math` import from the neutral file; `trade-math` re-exports for public API.

| Pros | Cons |
|------|------|
| Neither package “owns” commission | Introduces a new top-level core folder (closer to “new architecture”) |
| Symmetric dependency | Slightly larger than Option A for one function |

### Option C — Inline / duplicate formula inside `execution-engine.ts`

Keep `trade-math.calculateCommission` as-is; copy the formula into `buildFill`.

| Pros | Cons |
|------|------|
| Tiny diff | Two sources of truth; drift risk; contradicts ADR 0010 “do not duplicate” |
| No new file | Harder to keep tests meaningful for one formula |

### Option D — Move all of `trade-math.ts` into execution

| Pros | Cons |
|------|------|
| Clears upward imports | Moves PnL helpers that are backtest/`Trade`-oriented; larger than needed; risks API churn |

### Option E — Break downward edges instead (backtest stops importing execution)

Would require folding execution into backtest or inverting ADR 0004.

| Pros | Cons |
|------|------|
| None for this migration | Rejects shared execution path; large refactor; out of scope |

### Comparison

| Option | Diff size | API stable | Behavior stable | New architecture? | Drift risk | Cycle broken? |
|--------|-----------|------------|-----------------|-------------------|------------|---------------|
| **A — execution/commission.ts + re-export** | Smallest meaningful | Yes | Yes | No (file beside existing module) | Low | Yes |
| B — neutral `src/core/math` | Small | Yes | Yes | Mild (new folder) | Low | Yes |
| C — duplicate formula | Tiny | Yes | Until drift | No | **High** | Yes |
| D — move all trade-math | Large | Fragile | Likely | No | Medium | Yes |
| E — invert layering | Very large | No | Risky | Yes | High | Yes |

### Recommendation (safest)

**Choose Option A.**

It is the smallest change that:

1. Removes the **only** `execution → backtest` edge.
2. Aligns commission ownership with ADR 0004 (execution).
3. Preserves every public export path via re-export from `trade-math`.
4. Leaves legitimate `backtest → execution` dependencies intact.
5. Avoids new packages, renames, and duplicate formulas.

### Explicit non-goals for the follow-up implementation PR

- Do not move `estimateFillPrice` or PnL helpers.
- Do not rename `calculateCommission`.
- Do not change `BacktestEngine` / `order-sizing` / `Portfolio` behavior.
- Do not move packages or create `@quantlab/core`.
- Do not delete `trade-math.ts`.

---

## Decision

1. **Document** the cycle as above (this ADR).
2. **Implement next** (separate PR): Option A — extract `calculateCommission` to `src/core/execution/commission.ts`, update `execution-engine.ts`, re-export from `trade-math.ts`.
3. **Verify** with existing Vitest suites under `src/core/execution` and `src/core/backtest` (and full `npm test` if CI requires).
4. Treat Option B as fallback only if Option A is rejected for layering reasons.

## Consequences

**Positive**

- Acyclic module graph: `backtest → execution → (commission leaf)`; `trade-math` may depend on execution commission leaf but execution no longer depends on backtest.
- Unblocks later incremental extraction per ADR 0010.
- Commission has a single implementation.

**Negative**

- `trade-math` re-export creates a thin dependency from backtest math barrel toward execution for one symbol (acceptable tradeoff for API stability).
- Until the follow-up PR lands, the cycle remains in the tree.

**Neutral**

- Public import paths stay the same; callers need not change.

## Alternatives considered

See Options A–E above. Rejected: C (duplication), D (oversized move), E (architecture inversion). Deferred: B (neutral folder) unless A is declined.

## References

- ADR 0004 — Shared Execution Engine
- ADR 0010 — Canonical Backtest Authority
- `src/core/execution/execution-engine.ts`
- `src/core/backtest/trade-math.ts`
- `src/core/backtest/BacktestEngine.ts`
- `src/core/backtest/order-sizing.ts`
- `src/core/backtest/Portfolio.ts`
