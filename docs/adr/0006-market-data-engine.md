# ADR 0006: Market Data Engine

## Status

Accepted

## Context

ADR 0001 introduced `MarketDataProvider` for fetching candles from exchanges or mock sources. As QUANTLAB added backtesting, dashboard integration, and planned replay/paper/live modes, callers began importing providers directly — coupling UI and simulation code to adapter implementations.

Replay mode needs bar-by-bar stepping with events. Live mode needs streaming. Backtesting needs bulk historical loads. These are different consumption patterns over the same `Candle` type.

## Decision

Create `src/core/market/` with a `MarketDataEngine` that coordinates feeds:

| Feed | Purpose |
|------|---------|
| `HistoricalFeed` | Bulk candle loading for backtesting |
| `ReplayFeed` | Bar-by-bar replay with play/pause/step/seek/speed |
| `LiveFeed` | Interface stub for future exchange streaming |

All feeds implement `MarketFeed` (`connect`, `disconnect`, `subscribe`, `getCurrentBar`, `getHistory`). Feeds emit strongly typed events through the engine's event bus.

`BacktestEngine` loads data via `HistoricalFeed` through `runWithHistoricalFeed()`. The dashboard pipeline uses `MarketDataEngine` — never providers directly.

Providers in `src/data/providers/` remain as adapter implementations injected into feeds.

## Consequences

**Positive**

- Single entry point for all market data consumption.
- Replay and live modes can be added without changing backtest or dashboard code.
- Typed events enable future UI subscriptions (charts, replay studio).
- Provider adapters stay exchange-specific and swappable.

**Negative**

- Additional layer above ADR 0001 providers.
- `LiveFeed` is not yet connected to any venue.

## Alternatives considered

1. **Use providers directly everywhere** — rejected; blocks replay events and couples UI to adapters.
2. **Single feed type with mode flag** — rejected; historical bulk load and streaming replay have incompatible APIs.

## Relation to ADR 0001

ADR 0001 covers the provider adapter boundary. ADR 0006 covers the feed coordination layer above providers. Both remain in effect.
