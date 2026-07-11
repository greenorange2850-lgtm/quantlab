# ADR 0001: Market Data Provider Abstraction

## Status

Accepted

## Context

QuantLab initially fetched Binance klines directly via `fetchKlines()` in `src/data/binance.ts`. This worked for a single demo but couples the trading engine to one exchange, one HTTP shape, and one error model.

Upcoming modules — backtesting, paper trading, unit tests, and alternative data sources — need the same `Candle[]` input without calling a live API.

## Decision

Introduce a `MarketDataProvider` interface with a single `getCandles()` method. Exchange-specific logic lives in `BinanceProvider`. Deterministic data lives in `MockMarketDataProvider`.

Strategies and indicators depend only on normalized `Candle` objects, never on Binance types or endpoints.

The legacy `fetchKlines()` function remains as a thin wrapper over `BinanceProvider` for backward compatibility.

## Consequences

**Positive**

- Strategies are testable with `MockMarketDataProvider` (no network).
- New exchanges add a provider implementation without touching strategy code.
- Clear boundary for future caching, persistence, and streaming.

**Negative**

- One extra indirection layer compared to direct `fetch` calls.
- Legacy `binance.ts` must be maintained until all callers migrate to providers.

## Alternatives considered

1. **Keep direct Binance calls** — rejected; blocks offline testing and multi-source support.
2. **Use a third-party market data SDK** — rejected; violates dependency-free constraint and adds opaque abstractions.
