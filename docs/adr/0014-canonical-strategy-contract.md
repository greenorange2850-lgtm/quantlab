# ADR 0014: Canonical Strategy Contract

## Status

Accepted

## Context

ADR 0010–0013 established the canonical backtest engine and candle model. The simulation loop calls `strategy.evaluate(candles, symbol)`. The repository also contains persistence/API types named `Strategy` under `@trading-os/shared`, plus `StrategyEngine` / `IStrategyEngine` in `@trading-os/engines`.

This ADR inventories every Strategy-related interface/type/class, names the **canonical simulation contract**, and records that there is **no same-shape duplicate** of that contract to delete or re-export (unlike ADR 0013’s indicators `Candle`). Merging the shared DTO into the simulation interface (or vice versa) would change behavior and APIs and is out of scope.

## 1. Inventory

| Symbol | Path | Kind | Shape / role |
|--------|------|------|----------------|
| `Strategy` | `src/core/strategy/Strategy.ts` | **interface** | `name` + `evaluate(Candle[], symbol) → Signal` — **simulation contract** |
| `MovingAverageCrossStrategy` | `src/core/strategy/MovingAverageCrossStrategy.ts` | class | Implements core `Strategy` |
| `ScriptedStrategy` / `HoldStrategy` / `SequenceStrategy` | backtest `__tests__` | test classes | Implement core `Strategy` |
| `Strategy` | `packages/shared/src/types.ts` | interface | Persistence/API entity: `id`, `name`, `description`, `status`, versions, tags, timestamps |
| `StrategyVersion`, `StrategyRules`, `StrategyFilters`, `StrategyMetrics` | `packages/shared` | interfaces | Versioning / rules JSON / metrics DTOs |
| `IStrategyEngine` / `StrategyEngine` | `packages/engines/src/strategy/strategy-engine.ts` | interface + class | CRUD/version façade over **shared** `Strategy` — not `evaluate` |
| `StrategyRepository` | `packages/database/.../strategy.repository.ts` | class | Loads shared `Strategy` / `StrategyVersion` from SQLite |
| `BestStrategySummary` | `packages/shared` | interface | Dashboard summary DTO |
| `StrategyHealthProps` | `src/features/dashboard/StrategyHealth.tsx` | UI props | Presentation only |

**Rule-engine:** plugins implement `IRulePlugin`, not `Strategy`. No rule-engine strategy contract overlaps the simulation interface.

## 2. Canonical simulation contract

**Canonical:** `src/core/strategy/Strategy.ts`

```typescript
interface Strategy {
  readonly name: string
  evaluate(candles: Candle[], symbol: string): Signal
}
```

**Consumers:** `BacktestEngine`, `MovingAverageCrossStrategy`, `run-backtest-pipeline`, CLI demos, backtest tests.

**Not canonical for simulation:** `@trading-os/shared` `Strategy` (no `evaluate`); `StrategyEngine` (versioning stub).

## 3. Duplicate analysis

| Candidate | Same shape as core `Strategy`? | Action |
|-----------|--------------------------------|--------|
| Shared `Strategy` | **No** (entity DTO vs evaluate port) | **Keep** — domain DTO; do not re-export as core |
| `IStrategyEngine` | **No** | **Keep** — engine registry API |
| Test strategy classes | Implementations, not contracts | **Keep** |
| Second `interface Strategy` under `src/core` | **None found** | N/A |

**Conclusion:** There is nothing to remove or collapse without renaming/changing shared APIs. No code refactor is required for contract deduplication.

## 4. Dependency graph (simulation)

```text
Candle (src/data/candles)     Signal (src/core/signals)
            \                       /
             \                     /
              v                   v
         Strategy  (src/core/strategy/Strategy.ts)   ← CANONICAL
              ^
              |
    MovingAverageCrossStrategy
              ^
              |
    BacktestEngine.run / runWithHistoricalFeed
              ^
              |
    run-backtest-pipeline / examples / tests
```

```text
@trading-os/shared Strategy (DTO)
        ^
        |
 StrategyRepository / StrategyEngine / HTTP strategy routes
        ✗ does not feed BacktestEngine.evaluate
```

## 5. Decision

1. Canonical simulation strategy contract = `src/core/strategy/Strategy.ts`.  
2. Do not treat shared `Strategy` as a duplicate of the simulation contract.  
3. Do not change `MovingAverageCrossStrategy`, rule-engine plugins, or shared DTOs under this ADR.  
4. Preserve public export via `src/core/strategy/index.ts` (`export type { Strategy }`).  
5. Future adapters (API → engine) must map `StrategyVersion` → a core `Strategy` **implementation**, not replace this interface with the DTO.

## Consequences

**Positive:** Clear authority for `BacktestEngine`; avoids a false “merge” of incompatible `Strategy` types.  
**Negative:** Homonymous `Strategy` in shared vs core remains a naming hazard for contributors.  
**Neutral:** No runtime change from accepting this ADR.

## Alternatives considered

1. **Rename shared `Strategy` → `StrategyEntity`** — clearer, but violates “preserve public APIs / no renames” for this step.  
2. **Re-export shared `Strategy` from core** — rejected; incompatible shapes would break the type system or force a rewrite.  
3. **Invent a third `ITradingStrategy` name now** — rejected; unnecessary new architecture.

## References

- ADR 0010, 0012, 0013  
- `src/core/strategy/Strategy.ts`  
- `src/core/backtest/BacktestEngine.ts`  
- `packages/shared/src/types.ts`  
- `docs/strategy-engine.md`  
