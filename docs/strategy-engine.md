# Strategy Engine

Foundation for QuantLab's trading engine: market data providers feed candles into pure strategies that emit signals.

## Architecture

```
MarketDataProvider  →  Candles  →  Strategy.evaluate()  →  Signal
        ↑                              ↑
 BinanceProvider              MovingAverageCrossStrategy
 MockMarketDataProvider
```

Layers are intentionally separate so future modules (risk, backtesting, paper trading, AI) can plug in without rewriting core logic.

| Layer | Responsibility |
|-------|----------------|
| **Market Data** | Fetch or generate normalized `Candle[]` |
| **Indicators** | Pure math on price series (SMA, EMA, RSI) |
| **Strategy** | Business rules mapping candles → `Signal` |
| **Signals** | Typed output (`BUY`, `SELL`, `HOLD`) with confidence and reason |

Strategies never import exchange clients. Providers never know about indicators or signals.

## Provider abstraction

`MarketDataProvider` exposes a single method:

```typescript
getCandles({ symbol, interval, limit }): Promise<Candle[]>
```

Implementations:

- **BinanceProvider** — live REST data via native `fetch`
- **MockMarketDataProvider** — deterministic synthetic candles (seeded PRNG)

Consumers depend on the interface, not a specific exchange.

## Strategy interface

```typescript
interface Strategy {
  readonly name: string
  evaluate(candles: Candle[], symbol: string): Signal
}
```

Strategies are stateless and receive all context through `candles`. The returned `Signal` includes:

| Field | Description |
|-------|-------------|
| `signal` | `BUY`, `SELL`, or `HOLD` |
| `confidence` | 0–1 strength estimate |
| `reason` | Human-readable explanation |
| `timestamp` | Candle time of evaluation |
| `symbol` | Instrument evaluated |

## Signal flow

1. A provider downloads or generates candles.
2. A strategy computes indicators internally.
3. Rules evaluate the latest bar (e.g. EMA cross + RSI filter).
4. A `Signal` is returned to the caller (CLI demo today; execution engine later).

### MovingAverageCrossStrategy

| Condition | Signal |
|-----------|--------|
| EMA20 crosses above EMA50 and RSI > 50 | `BUY` |
| EMA20 crosses below EMA50 and RSI < 50 | `SELL` |
| Crossover without RSI confirmation | `HOLD` |
| No crossover | `HOLD` |

## Running the demo

```bash
npm run demo:strategy
```

Downloads live `BTCUSDT` candles via `BinanceProvider`, runs `MovingAverageCrossStrategy`, and prints the current signal with EMA/RSI values.
