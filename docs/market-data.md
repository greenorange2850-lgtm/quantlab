# Market Data

Fetch and normalize candle data from Binance for use with the indicator engine.

## Binance endpoint

`GET https://api.binance.com/api/v3/klines`

| Parameter | Description |
|-----------|-------------|
| `symbol` | Trading pair (e.g. `BTCUSDT`) |
| `interval` | Candle interval (e.g. `1h`, `4h`, `1d`) |
| `limit` | Number of candles (1–1000) |

The client is implemented in `src/data/binance.ts` using native `fetch` — no SDK or HTTP library.

## Normalization

Binance returns each candle as a 12-element array. `src/data/candles.ts` converts these into typed `Candle` objects:

| Field | Source | Type |
|-------|--------|------|
| `time` | index 0 (open time) | `number` (ms) |
| `open` | index 1 | `number` |
| `high` | index 2 | `number` |
| `low` | index 3 | `number` |
| `close` | index 4 | `number` |
| `volume` | index 5 | `number` |

String price fields are parsed to numbers. Invalid or empty responses throw descriptive errors.

## Example usage

```bash
npm run demo:indicators
```

This downloads 100 `BTCUSDT` 1-hour candles, computes EMA(20) and RSI(14) on close prices, and prints the latest values.

Programmatic usage:

```typescript
import { fetchKlines } from '../data/binance.js'
import { extractClosePrices } from '../data/candles.js'
import { calculateEMA, calculateRSI } from '../core/indicators/index.js'

const candles = await fetchKlines('BTCUSDT', '1h', 100)
const closes = extractClosePrices(candles)
const ema = calculateEMA(closes, 20)
const rsi = calculateRSI(closes, 14)
```
