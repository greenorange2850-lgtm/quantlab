# Research Analytics

Post-backtest analytics layer for QuantLab. Consumes `BacktestResult` from the execution engine and produces structured reports, metrics, and exports without modifying simulation logic.

## Architecture

```
BacktestEngine.run()  →  BacktestResult  →  buildBacktestReport()  →  BacktestReport
                                                    ↓
                                          CSV / JSON export
```

| Module | Responsibility |
|--------|----------------|
| `equity-curve` | Enrich raw equity points with per-bar drawdown |
| `drawdown` | Current/max drawdown, duration, recovery |
| `monthly-returns` | Monthly and cumulative return breakdown |
| `trade-analyzer` | Win/loss stats, profit factor, expectancy, LONG vs SHORT |
| `report-builder` | Assemble structured `BacktestReport` |
| `export-csv` / `export-json` | File serialization (no external libraries) |

Analytics depends on backtest output — never the reverse.

## Execution model

The backtest engine records `time`, `equity`, and `cash` at each bar close. Analytics enriches this series and computes derived metrics using **pure functions** only.

Signals and fills remain unchanged in `BacktestEngine`.

## Trade lifecycle (analytics view)

1. Closed trades from `BacktestResult.trades` feed `analyzeTrades()`.
2. Metrics include average win/loss, profit factor, expectancy, holding time, and per-direction performance.
3. Top trades are ranked by PnL for quick review.

## Statistics

### Drawdown

- `currentDrawdown` — drawdown at final bar
- `maxDrawdown` — peak-to-trough percentage
- `maxDrawdownDurationMs` — longest drawdown episode
- `maxDrawdownRecoveryMs` — trough-to-recovery time (null if unrecovered)

### Monthly returns

Grouped by UTC month from the equity curve: monthly return, cumulative return, best/worst month.

### Trade analysis

`averageWin`, `averageLoss`, `largestWinner`, `largestLoser`, `profitFactor`, `expectancy`, `averageHoldingTimeMs`, LONG/SHORT breakdown.

## Running the demo

```bash
npm run demo:analytics
```

Runs a BTCUSDT backtest with `MovingAverageCrossStrategy`, prints the analytics report, and exports:

- `backtest-report.json`
- `trades.csv`
- `equity.csv`

## Programmatic usage

```typescript
import { BacktestEngine } from '../core/backtest/index.js'
import { buildBacktestReport, exportTradesCsv } from '../core/analytics/index.js'

const result = engine.run(candles, strategy, config)
const report = buildBacktestReport(result)
const csv = exportTradesCsv(result.trades)
```
