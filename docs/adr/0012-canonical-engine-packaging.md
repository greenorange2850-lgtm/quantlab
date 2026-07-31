# ADR 0012: Canonical Engine Packaging

## Status

Accepted (packaging **plan** only — no file moves, no new package, no runtime change in this ADR)

## Context

ADR 0010 established `src/core/backtest/BacktestEngine` as the canonical simulator. Server integration and reuse by `@trading-os/api` are blocked in part because the engine lives inside the Vite app tree (`src/`), not as a workspace package.

This ADR inventories what belongs to that canonical simulation stack, classifies modules, records the dependency graph, lists packaging blockers, and proposes a **minimum extraction order**. It does **not**:

- move files
- create `@quantlab/core` (or any new package)
- implement packaging
- change runtime behavior

Related: ADR 0002 (event-driven backtest), ADR 0004 (execution), ADR 0010 (authority), ADR 0011 (execution↔backtest cycle plan / Option A).

**Repository snapshot note:** On `main` at the time of writing, `execution-engine.ts` still imports `calculateCommission` from `backtest/trade-math.ts` (cycle present). ADR 0011 Option A is the prerequisite fix before any package extraction of execution + backtest.

---

## 1. Inventory — modules of the canonical simulation engine

Paths are relative to the repository root. Tests are listed separately under blockers / extraction gates.

### 1.1 Core simulation (must ship with the eventual engine package)

| Path | Role |
|------|------|
| `src/core/backtest/BacktestEngine.ts` | Canonical simulator (`run`, `runWithHistoricalFeed`) |
| `src/core/backtest/BacktestConfig.ts` | Config + validation |
| `src/core/backtest/BacktestResult.ts` | Result, statistics, equity point types |
| `src/core/backtest/Trade.ts` | Simulation trade model |
| `src/core/backtest/Position.ts` | Open position model |
| `src/core/backtest/Portfolio.ts` | Simulation portfolio (apply fills) |
| `src/core/backtest/order-sizing.ts` | Signal → `OrderRequest` + risk sizing |
| `src/core/backtest/statistics.ts` | Result statistics |
| `src/core/backtest/trade-math.ts` | PnL / duration / legacy qty (+ commission today) |
| `src/core/backtest/index.ts` | Barrel |
| `src/core/execution/*` | `executeOrder`, `ExecutionEngine`, `OrderManager`, fills, requests, context |
| `src/core/risk/*` | `RiskConfig`, `calculatePositionSize`, validators |
| `src/core/signals/*` | `Signal`, `SignalType` |
| `src/core/models/order.ts` | `OrderSide`, `OrderType`, `OrderStatus` (used by execution/backtest) |
| `src/core/models/position.ts` | Used by portfolio helpers; also related domain |
| `src/core/strategy/Strategy.ts` | `Strategy` interface (engine peer contract) |

**Reference strategy (simulation peer, not the engine loop itself):**

| Path | Role |
|------|------|
| `src/core/strategy/MovingAverageCrossStrategy.ts` | Default/demo strategy implementation |
| `src/core/strategy/index.ts` | Barrel |
| `src/core/indicators/sma.ts`, `ema.ts`, `rsi.ts` | Used by MA cross |
| `src/core/indicators/types.ts` | Indicator `Candle` / series types (duplicate of data candle shape) |
| `src/core/indicators/index.ts` | Public indicator exports |

**Stub indicator files (present, not required for MA backtest):**  
`atr.ts`, `bollinger.ts`, `macd.ts`, `vwap.ts` — throw `Not implemented`; optional later.

**Models not on the hot path but in the same domain folder:**  
`src/core/models/account.ts`, `src/core/models/trade.ts`, `src/core/models/index.ts`.

### 1.2 Market / feed adapters

| Path | Role |
|------|------|
| `src/core/market/historical-feed.ts` | Historical load for `runWithHistoricalFeed` |
| `src/core/market/market-feed.ts` | Feed interface |
| `src/core/market/candle-stream.ts` | Stream helper |
| `src/core/market/events.ts` | Market events |
| `src/core/market/market-data-engine.ts` | Feed factory / coordinator |
| `src/core/market/replay-feed.ts` | Replay (UI/roadmap; not required for `run`) |
| `src/core/market/live-feed.ts` | Stub live feed |
| `src/core/market/index.ts` | Barrel |
| `src/data/candles.ts` | **`Candle` type** + Binance normalize helpers |
| `src/data/providers/MarketDataProvider.ts` | Provider port |
| `src/data/providers/MockMarketDataProvider.ts` | Deterministic mock |
| `src/data/providers/BinanceProvider.ts` | HTTP Binance REST (`fetch`) |
| `src/data/providers/index.ts`, `src/data/binance.ts` | Provider barrel / helpers |

### 1.3 Dashboard / UI orchestration

| Path | Role |
|------|------|
| `src/core/dashboard/run-backtest-pipeline.ts` | Wires mock feed + MA strategy + engine + report |
| `src/core/dashboard/dashboard-view-model.ts` | `BacktestReport` → `@trading-os/shared` `DashboardData` |
| `src/core/dashboard/empty-dashboard.ts` | Empty `DashboardData` |
| `src/core/dashboard/index.ts` | Barrel |
| App consumers | `src/stores/backtest.store.ts`, `src/pages/StrategyLabPage.tsx`, `src/pages/DashboardPage.tsx`, features |

### 1.4 Analytics

| Path | Role |
|------|------|
| `src/core/analytics/report-builder.ts` | `BacktestResult` → `BacktestReport` |
| `src/core/analytics/types.ts` | Report types |
| `src/core/analytics/equity-curve.ts`, `drawdown.ts`, `monthly-returns.ts`, `trade-analyzer.ts` | Analyses |
| `src/core/analytics/export-csv.ts`, `export-json.ts` | Exports |
| `src/core/analytics/index.ts` | Barrel |

### 1.5 Examples

| Path | Role |
|------|------|
| `src/examples/backtest-demo.ts` | CLI demo → core engine + Binance |
| `src/examples/analytics-demo.ts` | CLI demo → engine + analytics |
| `src/examples/strategy-demo.ts` | Strategy evaluation demo |
| `src/examples/indicator-demo.ts` | Indicators demo |

### 1.6 Browser-specific

| Path / config | Finding |
|---------------|---------|
| `src/data/providers/BinanceProvider.ts` | Uses global `fetch` (browser + Node 18+) |
| App `tsconfig.app.json` | `"lib": ["ES2023", "DOM"]`, Vite client types — applies to **app** compile of `src/**`, not a package boundary |
| `src/core/**` simulation modules | **No** `window` / `document` / `import.meta` usage found |
| Dashboard / stores / React pages | Browser UI — **outside** engine package |

### 1.7 Shared utilities / adjacent helpers

| Path | Role |
|------|------|
| `src/core/portfolio/*` | Portfolio **snapshot** builders for dashboard VM (not backtest `Portfolio` class) |
| `src/data/candles.ts` `extractClosePrices` | Used by strategies/indicators path |
| Future `execution/commission.ts` (ADR 0011) | Pure commission leaf after Option A |

---

## 2. Classification summary

| Bucket | Include in eventual engine package? | Notes |
|--------|-------------------------------------|-------|
| **Core simulation** | **Yes** | `backtest`, `execution`, `risk`, `signals`, needed `models`, `Strategy` interface |
| **Reference strategy + indicators** | **Optional peer** or same package | Required for demos; not required for `run(candles, strategy, config)` if caller supplies `Strategy` |
| **Market/feed adapters** | **Separate adapter layer / optional entry** | `run()` needs only `Candle[]`; feeds + providers are I/O |
| **Analytics** | **Separate consumer package or app** | Depends on `BacktestResult` only (downstream) |
| **Dashboard/UI** | **No — stay in app** | Depends on `@trading-os/shared` + React stores |
| **Examples** | **No — stay in app/scripts** | CLI entrypoints |
| **Browser-specific** | **Exclude from core package** | Keep Binance provider in app or a data adapter package |
| **Shared utilities** | Portfolio VM helpers with dashboard; candle type must be owned carefully | See blockers |

---

## 3. Dependency graph

### 3.1 Portable core (`BacktestEngine.run`)

```text
Candle (today: src/data/candles)
Strategy (interface)
Signal / SignalType
        │
        ▼
┌─────────────────── order-sizing ───────────────────┐
│  risk (calculatePositionSize, RiskConfig)          │
│  execution.estimateFillPrice                       │
│  models (OrderSide/Type)                           │
└────────────────────────┬───────────────────────────┘
                         ▼
┌─────────────────── BacktestEngine.run ─────────────┐
│  BacktestConfig / Portfolio / statistics           │
│  ExecutionEngine.executeOrder → Fill               │
│  trade-math (PnL; commission ⚠ see cycle)         │
└────────────────────────┬───────────────────────────┘
                         ▼
                   BacktestResult
```

### 3.2 Optional feed entry (`runWithHistoricalFeed`)

```text
MarketDataProvider → HistoricalFeed → Candle[] → BacktestEngine.run
MarketDataEngine (factory) ──► HistoricalFeed | ReplayFeed | LiveFeed
```

### 3.3 App orchestration (not package core)

```text
runBacktestPipeline
  → MockMarketDataProvider + MarketDataEngine + MovingAverageCrossStrategy
  → BacktestEngine
  → buildBacktestReport (analytics)
  → dashboard-view-model → @trading-os/shared DashboardData
  → Zustand / React
```

### 3.4 Current cycle (blocks packaging)

```text
execution/execution-engine.ts ──► backtest/trade-math.ts (calculateCommission)
backtest/* ─────────────────────► execution/*
```

ADR 0011 Option A breaks the upward edge only.

### 3.5 Downstream-only (safe after core exists)

```text
analytics ──► backtest types/result
portfolio (VM) ──► models + used by dashboard
dashboard ──► analytics + backtest + portfolio + @trading-os/shared + data providers
```

---

## 4. Modules that prevent packaging (today)

| Module / area | Why it prevents a clean workspace package |
|---------------|-------------------------------------------|
| `execution` ↔ `backtest/trade-math` | Import **cycle** |
| `src/data/candles.ts` (+ Binance helpers in same file) | Core types live under **app `src/data`**, outside any package; coupled to exchange normalize helpers |
| Duplicate `indicators/types.ts` `Candle` | Two candle definitions; packaging must pick one owner |
| `src/core/market/*` → `src/data/providers/*` | Feed layer depends on app data providers |
| `BinanceProvider` | Network/`fetch`; not pure simulation |
| `dashboard/*` → `@trading-os/shared` | **Workspace** coupling to DTO package + presentation |
| `run-backtest-pipeline.ts` | Hard-wires mock provider + concrete strategy + analytics + shared types |
| App-only build | `src/core` compiled via Vite/`tsconfig.app` (`noEmit`, DOM lib, `@/*` paths) — **no** package `tsc` emit today |
| `@trading-os/api` / engines | Cannot depend on `src/core` with current `server` `rootDir` (integration packaging need) |
| Colocated Vitest under `src/core` | Tests assume app vitest root; package needs its own test entry or shared config |
| Name collision risk | `@trading-os/engines` already exports a stub `BacktestEngine` |

---

## 5. Blocker classification

| Blocker | Class | Evidence | Required before packaging? |
|---------|-------|----------|----------------------------|
| `execution` → `backtest/trade-math` | **import cycle** | `execution-engine.ts` import | **Yes** (ADR 0011 Option A) |
| `Candle` + helpers in `src/data/candles.ts` | **workspace dependency** (app tree) / build ownership | `BacktestEngine`, `Strategy`, market imports | **Yes** — own candle type in extractable unit without forcing Binance into core |
| Dashboard → `@trading-os/shared` | **workspace dependency** | `dashboard-view-model.ts`, `empty-dashboard.ts`, pipeline | Keep dashboard **out** of engine package |
| Vite `@/` and `@trading-os/*` aliases | **alias dependency** | `tsconfig.app.json`, `vite.config.ts` | Consumers use aliases; **core itself** mostly relative — package must not rely on `@/` |
| App `tsconfig` DOM + `noEmit` | **build dependency** | `tsconfig.app.json` | New package needs its own `tsc` emit like other `packages/*` |
| Root `npm run build` / vitest layout | **build dependency** / **test dependency** | `package.json` scripts, `vitest.config.ts` | Package `build` + tests must be wired into CI without breaking app |
| Colocated `__tests__` importing relative core | **test dependency** | e.g. `backtest/__tests__/*` | Move or dual-run tests when extracting; gate: all green each step |
| `BinanceProvider` `fetch` | **browser dependency** (also Node fetch) | `BinanceProvider.ts` | Exclude from core package; adapter-only |
| LiveFeed stub / Replay UI | Not a cycle; product stubs | `live-feed.ts` | Optional adapter; not required for `run` |
| Stub `@trading-os/engines` BacktestEngine | **workspace dependency** / naming | `packages/engines` | Must not be the extract target (ADR 0010) |

**Not classified as browser blockers for core simulation:** pure `backtest` / `execution` / `risk` / `signals` / `strategy` interface modules (no DOM APIs).

---

## 6. Minimum extraction order

Each step must **compile**, **pass all tests**, and **preserve behavior**. No step creates `@quantlab/core`. Preferred future name is left undecided here (e.g. reuse `@trading-os/…` vs other); this ADR only sequences readiness.

| Step | Action (conceptual — **do not execute in this ADR**) | Exit criteria |
|------|------------------------------------------------------|---------------|
| **E0** | Apply ADR 0011 Option A (`execution/commission` + `trade-math` re-export) | `execution` has zero imports of `backtest`; full test suite green |
| **E1** | Define package candle contract ownership (split or copy-type-stable `Candle` away from Binance-only helpers **without** behavior change to callers) | Core simulation imports candle from a non-provider module; demos/providers still work |
| **E2** | Treat **leaf pure modules** as first extract unit: `signals`, `risk`, `models` (order/position as needed), indicator math used by reference strategy | Unit tests for those modules green in isolation |
| **E3** | Extract **execution** (post-E0) as depending only on models + commission leaf | Execution tests green; no import of backtest |
| **E4** | Extract **backtest** (+ trade-math PnL) depending on execution, risk, signals, strategy interface, candle | Backtest + risk-integration tests green |
| **E5** | Optionally extract **strategy interface + MovingAverageCross + indicators** beside or with backtest | Strategy tests green |
| **E6** | Keep **market/feeds + providers** as a **follow-on adapter** package or app module; `run(candles, …)` remains the supported package API | Feed tests green; engine package does not import Binance |
| **E7** | Keep **analytics** as downstream package/app module depending on published `BacktestResult` types | Analytics tests green |
| **E8** | Keep **dashboard, examples, React stores** in the app; update imports to workspace package name when it exists | App typecheck/build + e2e demos green |
| **E9** | Only then wire `@trading-os/api` adapter to the workspace package (integration plan; out of scope here) | API can import engine without `src/` path hacks |

**Explicitly last / never in the engine package:** dashboard view-models, `@trading-os/shared` DTO mapping, stub engines package simulation logic.

---

## 7. Extraction step quality gate (mandatory)

For every future PR that actually moves or packages code:

1. `npm run typecheck` (or package-local `tsc`) succeeds  
2. `npm test` — full suite — passes  
3. No intentional behavior change to `BacktestEngine.run` semantics (ADR 0002 / 0010)  
4. Public re-exports preserved where ADR 0011-style compatibility is required  
5. CI job still builds app + packages  

If a step cannot meet the gate, **stop** — do not widen scope with rewrites.

---

## 8. Decision

1. The **eventual** reusable workspace package (name TBD; **not** `@quantlab/core`) will contain the **core simulation** inventory in §1.1 (after E0–E5), exposing primarily:

   ```text
   BacktestEngine.run(candles, strategy, config) → BacktestResult
   ```

2. **Market/feed providers**, **analytics**, **dashboard/UI**, and **examples** remain outside that package (adapters / app), per §2.

3. Packaging is **incremental** per §6; this ADR authorizes **planning only**.

4. **Do not** implement packaging, move files, or create packages under this ADR.

5. ADR 0011 cycle removal is a **hard prerequisite** (E0).

## Consequences

**Positive**

- Clear inventory and ownership boundaries before any move  
- Server/API reuse path becomes possible without forking the stub engine  
- Risk of pulling React/shared DTOs into the simulator is documented and rejected  

**Negative**

- `Candle` ownership and duplicate indicator candle types still need a careful E1 design  
- Until E0 lands on `main`, execution+backtest cannot be packaged safely  
- Naming collision with `@trading-os/engines` remains a future product decision  

**Neutral**

- Runtime behavior unchanged by accepting this ADR  
- Strategy Lab continues to use `src/core` in-place until a later extraction PR  

## Alternatives considered

1. **Big-bang move of all `src/core` into a package** — rejected; pulls dashboard/`@trading-os/shared`, feeds, and cycle issues at once; violates preserve-behavior and step gates.  
2. **Create `@quantlab/core` now** — rejected by product constraint and this ADR’s requirements.  
3. **Package only `BacktestEngine.ts` alone** — rejected; incomplete without execution/risk/signals/models/candle.  
4. **Make `@trading-os/engines` the extract target** — rejected; ADR 0010 forbids evolving the stub into a second simulator; rename/replace later is a separate decision.  
5. **Leave engine in `src/` forever; path-hack from server** — deferred as temporary integration tactic only; not a packaging strategy.

## References

- ADR 0002, 0004, 0010, 0011  
- `src/core/backtest/BacktestEngine.ts`  
- `src/core/execution/execution-engine.ts`  
- `src/core/dashboard/run-backtest-pipeline.ts`  
- `src/data/candles.ts`, `src/data/providers/*`  
- `packages/engines/src/backtest/backtest-engine.ts`  
- `tsconfig.app.json`, `vite.config.ts`, root `package.json` workspaces  
