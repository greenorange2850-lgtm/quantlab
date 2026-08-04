import type { Candle } from '@/data/candles'
import type { SmcEvent } from '@/core/smc'

export type SmcDisplayField = {
  label: string
  value: string
}

export type SmcEventDisplayValue = {
  /** Primary short label for list rows — never an artificial zero. */
  primary: string
  fields: SmcDisplayField[]
}

function fmt(n: number | null | undefined, digits = 4): string {
  if (n == null || !Number.isFinite(n)) return 'Unavailable'
  if (Math.abs(n) >= 1000) {
    return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
  }
  return n.toLocaleString('en-US', { maximumFractionDigits: digits })
}

/**
 * Typed display-value mapper for SMC events.
 * Never falls back to a generic event.price → 0 path.
 */
export function getSmcEventDisplayValue(
  event: SmcEvent,
  candles?: readonly Candle[],
): SmcEventDisplayValue {
  switch (event.kind) {
    case 'SWING_HIGH':
    case 'SWING_LOW':
    case 'INTERNAL_SWING_HIGH':
    case 'INTERNAL_SWING_LOW':
    case 'EXTERNAL_SWING_HIGH':
    case 'EXTERNAL_SWING_LOW':
      return {
        primary: fmt(event.price),
        fields: [{ label: 'Swing price', value: fmt(event.price) }],
      }

    case 'BULLISH_BOS':
    case 'BEARISH_BOS':
    case 'BULLISH_CHOCH':
    case 'BEARISH_CHOCH':
      return {
        primary: `close ${fmt(event.closePrice)} · level ${fmt(event.brokenSwingPrice)}`,
        fields: [
          { label: 'Break close', value: fmt(event.closePrice) },
          { label: 'Broken level', value: fmt(event.brokenSwingPrice) },
        ],
      }

    case 'BULLISH_DISPLACEMENT':
    case 'BEARISH_DISPLACEMENT': {
      const close =
        'closePrice' in event && typeof event.closePrice === 'number'
          ? event.closePrice
          : candles?.[event.candleIndex]?.close
      return {
        primary:
          close != null && Number.isFinite(close)
            ? `close ${fmt(close)} · body/ATR ${fmt(event.bodyAtrMultiple, 3)}`
            : `body ${fmt(event.bodySize)} · ATR ${fmt(event.atr)}`,
        fields: [
          { label: 'Candle close', value: fmt(close) },
          { label: 'Body size', value: fmt(event.bodySize) },
          { label: 'ATR', value: fmt(event.atr) },
          { label: 'Body / ATR', value: fmt(event.bodyAtrMultiple, 3) },
        ],
      }
    }

    case 'BULLISH_FVG_CREATED':
    case 'BEARISH_FVG_CREATED':
    case 'FVG_TOUCHED':
    case 'FVG_HALF_FILLED':
    case 'FVG_FULLY_FILLED':
    case 'FVG_INVALIDATED':
      return {
        primary: `${fmt(event.lowerBoundary)} – ${fmt(event.upperBoundary)}`,
        fields: [
          { label: 'Upper boundary', value: fmt(event.upperBoundary) },
          { label: 'Lower boundary', value: fmt(event.lowerBoundary) },
          { label: 'Midpoint', value: fmt(event.midpoint) },
        ],
      }

    case 'EQUAL_HIGHS':
    case 'EQUAL_LOWS':
      return {
        primary: fmt(event.level),
        fields: [{ label: 'Grouped level', value: fmt(event.level) }],
      }

    case 'BUY_SIDE_LIQUIDITY_SWEEP':
    case 'SELL_SIDE_LIQUIDITY_SWEEP':
      return {
        primary: `level ${fmt(event.sweptLevel)} · close ${fmt(event.close)}`,
        fields: [
          { label: 'Swept level', value: fmt(event.sweptLevel) },
          { label: 'Wick extreme', value: fmt(event.wickExtreme) },
          { label: 'Close', value: fmt(event.close) },
        ],
      }

    case 'BULLISH_ORDER_BLOCK_CREATED':
    case 'BEARISH_ORDER_BLOCK_CREATED':
    case 'ORDER_BLOCK_TOUCHED':
    case 'ORDER_BLOCK_MITIGATED':
    case 'ORDER_BLOCK_INVALIDATED':
      return {
        primary: `${fmt(event.zoneLow)} – ${fmt(event.zoneHigh)}`,
        fields: [
          { label: 'Zone low', value: fmt(event.zoneLow) },
          { label: 'Zone high', value: fmt(event.zoneHigh) },
          { label: 'Midpoint', value: fmt(event.midpoint) },
        ],
      }

    default:
      return { primary: 'Unavailable', fields: [] }
  }
}

/** True when a display string is a fabricated numeric zero from missing data. */
export function isArtificialZeroDisplay(primary: string): boolean {
  return primary === '0' || primary === '0.0000' || primary === '0.00'
}
