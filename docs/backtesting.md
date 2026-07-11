# Backtesting Engine

Event-driven historical simulation for QuantLab strategies. The engine replays candles bar-by-bar, evaluates strategies without lookahead, and models portfolio cash, positions, commissions, and trade statistics.

## Architecture

```
Candles  →  BacktestEngine.run()  →  BacktestResult
                ↑        ↓
            Strategy   Portfolio
                         ↓
                      Trades + Statistics
```

| Module | Responsibility |
|--------|----------------|
| `BacktestEngine` | Bar-by-bar simulation loop, signal scheduling, execution |
| `Portfolio` | Cash, open position, closed trades |
| `Strategy` | Maps candle history → `Signal` (unchanged interface) |
| `statistics` | Pure functions for win rate, drawdown, PnL aggregates |
| `trade-math` | Commission, PnL, sizing calculations |

The engine has no knowledge of Binance or any data provider. Demos and tests inject candles from providers or fixtures.

## Execution model

1. **Signal generation** — At the close of bar `i`, the strategy receives only `candles[0..i]`.
2. **Execution delay** — Non-`HOLD` signals are queued and executed at the **open** of bar `i+1`.
3. **Market fills** — All orders fill at the next candle open price (no slippage model yet).
4. **Final bar** — Signals on the last candle are ignored (no next open to fill).

### Signal semantics

| Signal | Flat | LONG open | SHORT open |
|--------|------|-----------|------------|
| `BUY` | Open LONG | No action | Close SHORT |
| `SELL` | Open SHORT | Close LONG | No action |
| `HOLD` | No action | No action | No action |

Only one position may be open at a time.

## Trade lifecycle

1. Entry — `BUY` or `SELL` opens a `LONG` or `SHORT` position sized by `positionSizePercent` of current equity.
2. Mark-to-market — Equity updates each bar using the candle close.
3. Exit — Opposite signal closes the position and records a `Trade`.
4. Commission — Charged on entry and exit notional (`commissionPercent`).

### Trade fields

`id`, `symbol`, `entryTime`, `exitTime`, `entryPrice`, `exitPrice`, `quantity`, `direction`, `pnl`, `commission`, `duration`

## Configuration

| Field | Description |
|-------|-------------|
| `initialCapital` | Starting cash |
| `commissionPercent` | Per-side commission on notional |
| `positionSizePercent` | Fraction of equity allocated per entry |
| `symbol` | Instrument symbol passed to the strategy |

## Statistics

Computed from closed trades and the equity curve:

- `totalTrades`, `winningTrades`, `losingTrades`, `winRate`
- `netProfit`, `grossProfit`, `grossLoss`, `averageTrade`
- `maxDrawdown` (peak-to-trough on equity curve)
- `finalBalance`

## Running the demo

```bash
npm run demo:backtest
```

Downloads `BTCUSDT` candles, runs `MovingAverageCrossStrategy`, and prints a summary report.
