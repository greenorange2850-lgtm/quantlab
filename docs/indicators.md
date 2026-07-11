# Indicators

Pure-function technical indicators for numeric price series. Each returns an array the same length as the input; leading entries are `NaN` until enough history is available.

## SMA — Simple Moving Average

**Purpose:** Smooths price data by averaging the last *n* values. Useful for identifying trend direction and support/resistance levels.

**Formula:** For index `i` where `i >= period - 1`:

\[
\text{SMA}_i = \frac{1}{\text{period}} \sum_{j=0}^{\text{period}-1} \text{values}_{i-j}
\]

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `values` | `number[]` | Input series |
| `period` | `number` | Window size (must be > 0 and ≤ `values.length`) |

**Return value:** `number[]` — same length as `values`; indices `0..period-2` are `NaN`.

**Complexity:** O(n) time, O(n) space.

---

## EMA — Exponential Moving Average

**Purpose:** Weighted moving average that reacts faster to recent prices than SMA. Common for trend following and as input to other indicators (e.g. MACD).

**Formula:**

- Smoothing multiplier: \( k = \frac{2}{\text{period} + 1} \)
- Seed at index `period - 1` with SMA of the first `period` values
- For `i >= period`: \( \text{EMA}_i = \text{values}_i \cdot k + \text{EMA}_{i-1} \cdot (1 - k) \)

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `values` | `number[]` | Input series |
| `period` | `number` | Smoothing period (must be > 0 and ≤ `values.length`) |

**Return value:** `number[]` — same length as `values`; indices `0..period-2` are `NaN`.

**Complexity:** O(n) time, O(n) space.

---

## RSI — Relative Strength Index

**Purpose:** Momentum oscillator (0–100) measuring the speed and magnitude of price changes. Values above 70 often indicate overbought conditions; below 30, oversold.

**Formula (Wilder smoothing):**

1. Compute price changes: \( \Delta_i = \text{values}_i - \text{values}_{i-1} \)
2. Separate gains and losses over the initial `period` changes
3. Smooth with Wilder method: \( \text{avg} = \frac{\text{prev} \cdot (\text{period} - 1) + \text{current}}{\text{period}} \)
4. \( \text{RS} = \frac{\text{avgGain}}{\text{avgLoss}} \), \( \text{RSI} = 100 - \frac{100}{1 + \text{RS}} \)

When `avgLoss` is 0: RSI is 100 if there are gains, 50 if flat.

**Parameters:**

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `values` | `number[]` | — | Input series |
| `period` | `number` | `14` | Lookback period (must be > 0 and ≤ `values.length`) |

**Return value:** `number[]` — same length as `values`; indices `0..period-1` are `NaN`.

**Complexity:** O(n) time, O(n) space.
