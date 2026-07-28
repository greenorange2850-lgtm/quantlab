# ADR 0010: Canonical Backtest Authority

## Status

Accepted

## Context

QUANTLAB currently has two classes named `BacktestEngine`:

1. **`src/core/backtest/BacktestEngine`** — the working event-driven simulator (ADR 0002). It evaluates strategies bar-by-bar, sizes orders through risk helpers, routes fills through the shared execution path (ADR 0004), updates a simulation `Portfolio`, and returns `BacktestResult`. Strategy Lab and CLI demos already use this engine.
2. **`packages/engines/src/backtest/BacktestEngine`** — a stub in `@trading-os/engines` that accepts `@trading-os/shared` DTOs (`RunBacktestRequest` → `Backtest`), returns empty/queued metrics, and is called from `POST /api/v1/backtests/run`. It does **not** import or wrap `src/core`.

Allowing both to evolve as simulators would create parallel implementations, diverge execution semantics, and block a single research loop from UI to API to persistence.

Related migration constraints already agreed:

- Do not create `@quantlab/core`.
- Do not rewrite the working engine.
- Do not move files until an extraction plan says so.
- Preserve existing behavior.
- Extract and converge incrementally.

An import cycle already exists between `src/core/execution` (uses `backtest/trade-math` for commission) and `src/core/backtest` (uses execution for fills and sizing). That cycle must be removed before a clean extraction boundary is possible.

## Decision

### 1. Canonical engine

The **canonical backtest authority** is:

```text
src/core/backtest/BacktestEngine
```

Specifically, the portable core surface is:

```text
BacktestEngine.run(candles, strategy, config) → BacktestResult
```

Optional feed-based entry remains part of the same authority:

```text
BacktestEngine.runWithHistoricalFeed(feed, loadParams, strategy, config) → BacktestResult
```

ADR 0002 remains the design basis for simulation semantics (event-driven, next-bar open, no lookahead).

### 2. No parallel implementations

`packages/engines` **must not** grow a second simulator.

- No new bar-loop, portfolio, slippage, commission, or risk-sizing logic in the stub.
- `compare`, `replay`, and `calculateMetrics` on the stub must not become an alternate backtest engine.
- Future real behavior comes only from the canonical `src/core` engine (directly or via an adapter).

### 3. Adapters, not forks

UI, CLI, HTTP, and persistence are **adapters** around the canonical engine:

| Layer | Role |
|-------|------|
| `runBacktestPipeline` / Strategy Lab / Zustand | UI orchestration (feed choice, strategy choice, dashboard mapping) |
| `src/examples/*` | CLI orchestration |
| `POST /api/v1/backtests/run` (future) | HTTP adapter: map request → core inputs → `run` → map `BacktestResult` for API/DB |
| `@trading-os/engines` BacktestEngine (interim) | Non-evolving façade / placeholder until the HTTP adapter calls core |

`@trading-os/shared` types (`Backtest`, `Trade`, `RunBacktestRequest`, …) remain **persistence/API DTOs**. They are not the canonical simulation model. Any server cutover requires an explicit mapping between core `BacktestResult` / `Trade` and shared DTOs; that mapping is out of scope of this ADR until specified.

Presentation helpers (`src/core/analytics`, `src/core/dashboard` view-models, `src/core/portfolio` snapshot builders) **consume** engine output; they are not a second authority.

### 4. Incremental extraction

Extraction proceeds without a big-bang rewrite:

1. **Document authority** (this ADR).
2. **Freeze the stub** — no parallel simulation work.
3. **Keep file locations** until a later step explicitly moves or packages code.
4. **Preserve behavior** — existing `src/core` backtest/execution/risk/analytics tests remain the gate.
5. **Wire adapters later** — server route calls canonical `run` (or a thin wrapper), then optional persistence.
6. **Retire or thin the stub** only after the HTTP path no longer needs it for registry/health compatibility.

Out of the canonical engine surface for extraction purposes:

- Hard-wired mock feed + `MovingAverageCrossStrategy` inside `runBacktestPipeline`
- Dashboard view-model mapping
- SQLite / `BacktestRepository` (Node-only)

### 5. Dependency-cycle removal roadmap

Current cycle:

```text
src/core/execution → src/core/backtest/trade-math (calculateCommission)
src/core/backtest  → src/core/execution (fills, sizing helpers)
```

Roadmap (implementation in later steps; order fixed):

1. **Identify pure math** used by both layers (`calculateCommission` and any other shared pure helpers in `trade-math`).
2. **Place that math below both modules** (neutral module or relocate beside execution) so `execution` does not import `backtest`.
3. **Keep public function signatures stable** where callers already exist (`executeOrder`, sizing, tests).
4. **Only after the cycle is gone**, consider package/folder extraction of the backtest authority.
5. Do **not** “fix” the cycle by duplicating commission logic in both trees.

Peer dependencies of the engine (`strategy`, `signals`, `risk`, `models`, `data/candles`, optional `market` feeds) remain outside `backtest/` for now; they are required collaborators, not parallel engines.

## Consequences

**Positive**

- One simulation semantics story for research, demos, and future API.
- Clear adapter boundary: orchestration and DTO mapping stay outside `BacktestEngine.run`.
- Stub cannot silently diverge into a second product.
- Cycle removal is sequenced so extraction does not entrench bad imports.
- Matches the working browser and Node usage already proven by Strategy Lab and Vitest.

**Negative**

- Server `/backtests/run` remains a stub until an adapter + DTO mapping land.
- Two type systems (core vs `@trading-os/shared`) coexist until mapping or consolidation.
- Contributors must know that the npm package name `BacktestEngine` in `@trading-os/engines` is **not** the authority.

**Neutral**

- No `@quantlab/core` package is introduced by this decision.
- No file moves or engine rewrites are authorized by this ADR alone.

## Alternatives considered

1. **Evolve `@trading-os/engines` BacktestEngine into the real simulator** — rejected; duplicates ADR 0002 work, ignores the battle-tested `src/core` path, and splits UI vs API semantics.
2. **Create `@quantlab/core` and move the engine immediately** — rejected for this migration step; premature packaging without cycle removal and without an agreed public API boundary.
3. **Rewrite the working engine for “cleaner” layering first** — rejected; violates preserve-behavior and increases migration risk.
4. **Delete the stub immediately** — deferred; server registry/routes still instantiate it. Thin adapter or removal comes after HTTP cutover.
5. **Make shared `Backtest` DTOs the engine’s native model** — rejected; core `Trade` / timestamps / statistics shapes differ and would force a rewrite of the working pipeline.

## References

- ADR 0002 — Event-Driven Backtest Engine
- ADR 0004 — Shared Execution Engine
- ADR 0005 — Portfolio Engine
- `src/core/backtest/BacktestEngine.ts`
- `packages/engines/src/backtest/backtest-engine.ts`
- `server/src/routes/backtest.routes.ts`
- `src/core/dashboard/run-backtest-pipeline.ts`
