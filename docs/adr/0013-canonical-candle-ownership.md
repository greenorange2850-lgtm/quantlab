# ADR 0013: Canonical Candle Ownership

## Status

Accepted (analysis and ownership decision only — no code changes, renames, moves, or packages)

## Context

ADR 0012 identified `Candle` ownership as extraction step **E1**: the canonical simulator depends on a bar type that today lives under the Vite app tree (`src/data/candles.ts`), while the server stack uses ISO-string candle DTOs in `@trading-os/shared` and `@trading-os/market-data`. Multiple identically named (or near-named) types coexist.

This ADR inventories every candle-shaped type in the repository, classifies them, records consumers, decides **which type is canonical for simulation**, where adapters and timestamp conversion belong, what would own the type after future packaging, and the smallest extraction sequence — without modifying the codebase.

Constraints honored: no file moves, no type renames, no package creation, no new architecture; conclusions based only on the existing repository and ADR 0012.

---

## 1. Inventory — every Candle-related type

| # | Name | Path | Time field | Extra fields |
|---|------|------|------------|--------------|
| A | `Candle` | `src/data/candles.ts` | `time: number` (epoch ms) | `open, high, low, close, volume` |
| B | `Candle` | `src/core/indicators/types.ts` | `time: number` | Same OHLCV shape as A (structural duplicate; re-exported from `indicators/index.ts`) |
| C | `Candle` | `packages/shared/src/types.ts` | `timestamp: string` | `id`, `symbolId`, `timeframeId`, OHLCV |
| D | `ParsedCandle` | `packages/shared/src/types.ts` | `timestamp: string` | OHLCV only (import/parse shape) |
| E | `MarketCandle` | `packages/market-data/src/types/index.ts` | `timestamp: string` | `id`, `symbol`, `timeframe`, OHLCV, `spread`, `source`, `session?`, `createdAt` |
| F | `RawCandle` | `packages/market-data/src/types/index.ts` | `timestamp: string` | OHLCV + optional `spread` (parser/validator input) |
| G | `Candle` | `packages/rule-engine/src/types/index.ts` | `timestamp: string` | OHLCV only |
| H | `IntelligenceCandle` | `packages/market-intelligence/src/types/index.ts` | `timestamp: string` | OHLCV + optional `spread`, `session` |
| I | DB row `market_data` | `packages/database/.../002_market_data_engine.sql` | `timestamp TEXT` | symbol/timeframe strings + OHLCV + spread/source/session |
| J | DB row / shared mapping | `packages/database/.../market-data.repository.ts` (`CandleRow`) | `timestamp: string` | Maps to shared `Candle` (C) via `symbol_id` / `timeframe_id` (legacy `candles` table path) |

**Related non-candle time series (not candle types, listed to avoid confusion):**

- Core `EquityPoint.time: number` (`src/core/backtest/BacktestResult.ts`)
- Shared `EquityPoint.date: string` (`packages/shared`)
- Core trade `entryTime` / `exitTime: number`

**Binance wire format:** `BinanceKlineRaw` in `src/data/candles.ts` — tuple; field `[0]` open time → simulation `Candle.time`.

---

## 2. Classification

| Role | Canonical type in repo today | Rationale |
|------|------------------------------|-----------|
| **Canonical simulation Candle** | **A** — `src/data/candles.ts` `Candle` (`time: number`) | Sole type accepted by `BacktestEngine.run`, `Strategy.evaluate`, feeds, providers, simulation tests (ADR 0010 / 0012 core path) |
| **Duplicate simulation-shaped Candle** | **B** — `indicators/types.ts` `Candle` | Same shape; not imported by indicator implementations (they use `NumericSeries`); exported but unused as the engine’s import source |
| **API DTO Candle** | **C** — `@trading-os/shared` `Candle` | Declared in `GetCandlesResponse`; id-based identity for HTTP contracts |
| **Database Candle (MDE path)** | **E** / row **I** — `MarketCandle` + `market_data.timestamp TEXT` | Live Market Explorer / `@trading-os/market-data` query path |
| **Database Candle (legacy shared path)** | **C** / row **J** — `MarketDataRepository` returns shared `Candle` | Older repository still typed to shared DTOs |
| **Market-data package Candle** | **E** (+ import **F** `RawCandle`) | Engine import/query domain inside `@trading-os/market-data` |
| **Rule / intelligence Candle** | **G**, **H** | Pattern scan / scoring; ISO timestamps; not used by `src/core` backtest |
| **UI Candle** | No distinct TS interface | UI consumes **E** (via `/api/v1/market-data/candles` → `MarketCandle`-shaped JSON) in `src/market-data/*`, or orphaned `src/features/market-explorer` expecting shared-like `timestamp` fields. Strategy Lab charts use core report/equity (`time: number`), not bar DTOs |

---

## 3. Dependency graph (who consumes which)

### 3.1 Simulation Candle (A)

```text
src/data/candles.ts  Candle { time: number, OHLCV }
        ▲
        │
        ├── src/data/providers/MarketDataProvider.ts
        ├── src/data/providers/MockMarketDataProvider.ts
        ├── src/data/providers/BinanceProvider.ts  (via normalizeBinanceKline*)
        ├── src/core/strategy/Strategy.ts
        ├── src/core/strategy/MovingAverageCrossStrategy.ts
        ├── src/core/backtest/BacktestEngine.ts
        ├── src/core/market/{historical,replay,live}-feed.ts
        ├── src/core/market/{market-feed,candle-stream,events,market-data-engine}.ts
        ├── src/core/dashboard/{run-backtest-pipeline,dashboard-view-model}.ts
        ├── src/examples/*
        └── tests under src/core/backtest, src/core/market, src/data
```

### 3.2 Indicators duplicate (B)

```text
src/core/indicators/types.ts  Candle
        ▲
        └── re-export only (indicators/index.ts)
            (sma/ema/rsi do not import Candle)
```

### 3.3 Shared API / legacy DB Candle (C, D)

```text
@trading-os/shared Candle / ParsedCandle
        ▲
        ├── packages/shared/src/api.ts  (GetCandlesResponse)
        ├── packages/database/.../market-data.repository.ts
        └── (typed API surface; live MDE router returns MarketCandle path instead)
```

### 3.4 Market-data Candle (E, F)

```text
RawCandle ──parsers/validators/normalizers──► insert
MarketCandle ◄── QueryService / MarketDataEngineRepository.mapRow
        ▲
        ├── server/src/routes/market-data.routes.ts  GET /candles
        ├── src/market-data/hooks + CandleTable/CandleChart  (UI)
        └── (feeds rule-engine / intelligence via repository candle sources)
```

### 3.5 Rule-engine / intelligence (G, H)

```text
rule-engine Candle { timestamp: string }
        ▲── plugins, candle-math, ScanService, ICandleProvider

IntelligenceCandle { timestamp: string }
        ▲── analyzers, RepositoryCandleSource
```

### 3.6 Cross-stack gap (no edge today)

```text
MarketCandle / shared Candle  ──✗──►  src/data Candle
BacktestEngine                ──✗──►  packages/market-data
```

There is **no** existing adapter module converting ISO DB/API candles into simulation `Candle`.

---

## 4. Ownership decision

| Concern | Owner (logical) | Physical location today |
|---------|-----------------|-------------------------|
| **Canonical simulation bar** | Simulation / core engine (ADR 0010–0012) | `src/data/candles.ts` interface `Candle` — **mis-located** under data/providers helpers |
| Binance normalize helpers | Exchange adapter (not simulation ownership) | Same file as A |
| `MarketCandle` / `RawCandle` | `@trading-os/market-data` | `packages/market-data` |
| Shared `Candle` DTO | `@trading-os/shared` API contract | `packages/shared` |
| Rule / intelligence candles | Respective packages | `rule-engine`, `market-intelligence` |
| Indicators `Candle` (B) | Dead duplicate of A’s shape | `src/core/indicators/types.ts` |

**Decision:** The single canonical model for the **simulation engine** is type **A**:

```text
{ time: number; open: number; high: number; low: number; close: number; volume: number }
```

with `time` = **epoch milliseconds**.

Types C–H remain valid in their domains; they must **not** replace A inside `BacktestEngine` / `Strategy`. Convergence is via **adapters**, not by renaming or merging interfaces in this ADR.

---

## 5. Where adapters belong

| Boundary | Adapter responsibility | Belongs in (logical layer) |
|----------|------------------------|----------------------------|
| Binance REST → A | `normalizeBinanceKline(s)` already | **Exchange / provider adapter** (`src/data/providers` + helpers in `candles.ts`) |
| Mock generator → A | `MockMarketDataProvider` | **Provider adapter** |
| `MarketCandle` / DB → A | Map OHLCV; `timestamp` string → `time` number; drop id/spread/source | **Server or market→simulation bridge** (future API backtest integration; not in `src/core/backtest`) |
| Shared `Candle` (C) → A | Map OHLCV; ignore ids; ISO → epoch | Same bridge / API adapter |
| Rule-engine `Candle` (G) → A | Only if simulation ever consumes scan bars | Package-local or shared bridge — **not** required for current backtest path |
| A → UI charts | Strategy Lab uses report equity `time: number`; MDE UI uses `timestamp` strings from API | **UI** formats for display; do not change A |

Per ADR 0012: keep market/feeds and providers **outside** the eventual core simulation package; adapters sit on that boundary.

---

## 6. Timestamp conversion (ISO string ↔ epoch ms)

### 6.1 What exists today

| Location | Direction | Behavior |
|----------|-----------|----------|
| `normalizeBinanceKline` | Exchange open time **number** → `Candle.time` | Already epoch ms; no ISO |
| `MockMarketDataProvider` | Synthetic | Writes `time` as epoch ms directly |
| `normalizeTimestamp` (`market-data`) | Parse string → **ISO string** (`toISOString`) | Stays in string domain for Raw/Market candles |
| `sortByTimestamp` / validators | string → `Date.getTime()` for compare only | Does not emit simulation `Candle` |
| `HistoricalFeed` date filter | Compares `candle.time` to numeric `startDate`/`endDate` | Epoch ms domain |
| Core analytics `monthKey` | `EquityPoint.time` number → `Date` UTC | Not candle conversion |
| **MarketCandle → simulation Candle** | — | **Not implemented** |

### 6.2 Where conversion **must** happen (decision)

| Conversion | Allowed location | Forbidden location |
|------------|------------------|--------------------|
| ISO/`timestamp: string` → `time: number` | **Inbound adapter only** (API backtest orchestration, DB→engine loader, or explicit provider that targets simulation) | Inside `BacktestEngine.run`, `Portfolio`, `execution`, `risk`, indicator pure math |
| `time: number` → ISO string | **Outbound adapter only** (persist results, shared DTO mapping, HTTP responses that use shared/Market shapes) | Inside canonical simulation loop |
| Display formatting | UI components | Core engine |

**Invariant:** Once bars enter `BacktestEngine.run`, all bar times remain epoch ms through fills, trades, and equity points derived from those bars.

---

## 7. Future package ownership (after ADR 0012 packaging)

Without creating a package in this ADR:

| Artifact | Owns canonical simulation `Candle` after extraction |
|----------|-----------------------------------------------------|
| Eventual workspace package for core simulation (name **TBD**; **not** `@quantlab/core`) | **Yes** — candle type travels with E2–E4 extract unit (ADR 0012), as a **pure type module** free of Binance helpers |
| `@trading-os/market-data` | Continues to own `MarketCandle` / `RawCandle` |
| `@trading-os/shared` | Continues to own API `Candle` / `ParsedCandle` DTOs |
| App `src/data/providers` | Continues to own exchange-specific normalize → simulation candle |
| `@trading-os/engines` stub | Does **not** own candle types |

ADR 0012 E1 (“candle contract ownership”) is satisfied by: **simulation package owns type A’s shape**; **Binance normalize stays in app/adapter**; **ISO↔ms conversion stays in adapters** (§6).

---

## 8. Blockers preventing Candle extraction

| Blocker | Class (ADR 0012 taxonomy) | Detail |
|---------|---------------------------|--------|
| Type A colocated with Binance helpers in `src/data/candles.ts` | **workspace / build dependency** | Extracting “candle type only” requires splitting file **later**; helpers must not force network into core package |
| Duplicate type B in `indicators/types.ts` | **alias / ownership ambiguity** | Same name `Candle`, second definition; packaging must not export two conflicting `Candle`s |
| No `MarketCandle`→A adapter | **workspace dependency** gap | Blocks server canonical backtest until adapter exists (integration plan) |
| Dual DB representations (shared C vs MarketCandle E) | **workspace dependency** | Two persistence/API shapes; extraction of A does not remove this duality |
| App-only compile of `src/data` | **build dependency** | Candle type not in a workspace package emit path today |
| Consumers import deep relative paths to `src/data/candles.js` | **alias / import graph** | Many modules; any future move needs re-export compatibility (out of scope here — no renames now) |
| UI assumes `timestamp` string | **test / product boundary** | MDE UI not on type A; do not “fix” by changing UI to epoch without adapters |
| Rule-engine / intelligence string candles | Separate domains | Not blockers for simulation packaging if left as peer types |

**Not blockers for declaring ownership:** absence of `@quantlab/core`; presence of stub engines (different stack).

---

## 9. Smallest extraction sequence (recommendation)

Aligns with ADR 0012; **analyze-only here** — do not execute:

| Step | Action | Gate |
|------|--------|------|
| **C0** | Keep A as canonical simulation candle (this ADR) | Docs only |
| **C1** | After ADR 0011 E0 (commission cycle), when packaging begins: isolate type A’s interface from Binance normalize **without renaming** public `Candle` or changing field semantics (re-export normalize from same app path if needed) | compile + all tests + identical `time`/OHLCV behavior |
| **C2** | Resolve duplicate B by making indicators consume A (or stop exporting B) **without renaming** A — implementation PR later | indicator + strategy tests green |
| **C3** | Add **inbound** `MarketCandle`/`ParsedCandle` → A adapter at server/orchestration boundary when wiring `/backtests/run` | mapping tests; engine unchanged |
| **C4** | Move type A with core simulation package (ADR 0012 E1–E4); providers remain adapters producing A | package build + full suite |

Do **not** merge C/E/G/H into A. Do **not** change SQLite column types in this sequence’s early steps.

---

## Decision

1. **Canonical simulation Candle** = `src/data/candles.ts` `Candle` with `time: number` (epoch ms) and OHLCV.  
2. **indicators/types.ts `Candle`** is a duplicate shape, not a second authority.  
3. **Shared / MarketCandle / RawCandle / rule / intelligence** candles remain domain DTOs; conversion to A happens only in **adapters**.  
4. **ISO ↔ epoch ms** conversion is forbidden inside the simulation loop; allowed only at adapter boundaries (§6).  
5. **Future simulation workspace package** (name TBD, not `@quantlab/core`) owns the canonical candle **type**; exchange and DB packages do not.  
6. This ADR does not move files, rename types, create packages, or change runtime behavior.

## Consequences

**Positive**

- Clear single authority for `BacktestEngine` / `Strategy` bar type  
- Unblocks ADR 0012 E1 planning and API integration adapter design  
- Prevents accidental replacement of epoch-ms bars with ISO DTO candles inside the engine  

**Negative**

- Physical location of A under `src/data/` remains awkward until a later extraction PR  
- Duplicate B and dual DB candle paths remain until follow-up work  
- Server backtest still cannot run on DB candles without a new adapter  

**Neutral**

- No renames; existing import paths stay valid  
- MDE UI continues on `timestamp: string` JSON  

## Alternatives considered

1. **Make shared `Candle` (C) canonical for simulation** — rejected; would force rewrite of engine, feeds, providers, and tests from `time: number` to ISO strings (behavior/API churn).  
2. **Make `MarketCandle` canonical** — rejected; carries persistence metadata unsuitable for pure `run(candles, …)`.  
3. **Unify all packages onto one candle interface now** — rejected; violates no-rename / no-new-architecture / analyze-only constraints.  
4. **Leave ownership undefined until packaging PR** — rejected; ADR 0012 E1 requires an explicit decision first.

## References

- ADR 0010 — Canonical Backtest Authority  
- ADR 0011 — Break Execution–Backtest Import Cycle  
- ADR 0012 — Canonical Engine Packaging  
- `src/data/candles.ts`  
- `src/core/indicators/types.ts`  
- `packages/shared/src/types.ts`  
- `packages/market-data/src/types/index.ts`  
- `packages/rule-engine/src/types/index.ts`  
- `packages/market-intelligence/src/types/index.ts`  
- `src/core/backtest/BacktestEngine.ts`  
- `server/src/routes/market-data.routes.ts`  
