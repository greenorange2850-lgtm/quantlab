import { describe, expect, it } from 'vitest'
import type { Candle } from '@/data/candles'
import type { SmcDisplacementEvent } from '@/core/smc'
import {
  getSmcEventDisplayValue,
  isArtificialZeroDisplay,
} from '@/features/smc-lab/event-display'

function candle(i: number, c: number): Candle {
  return {
    time: 1_700_000_000_000 + i * 3_600_000,
    open: c - 1,
    high: c + 2,
    low: c - 2,
    close: c,
    volume: 1,
  }
}

describe('SMC event display mapper', () => {
  it('never renders an artificial zero price for displacement', () => {
    const event: SmcDisplacementEvent = {
      id: 'disp-bull-10-1',
      kind: 'BULLISH_DISPLACEMENT',
      candleIndex: 10,
      timestamp: 1,
      closePrice: 64_250.5,
      bodySize: 120,
      fullRange: 140,
      atr: 80,
      bodyAtrMultiple: 1.5,
      bodyToRangeRatio: 0.85,
      upperWick: 5,
      lowerWick: 15,
      structureBreakId: null,
      fvgId: null,
      reason: 'test',
      refs: [],
    }
    const display = getSmcEventDisplayValue(event)
    expect(display.primary).not.toBe('0')
    expect(isArtificialZeroDisplay(display.primary)).toBe(false)
    // Locale may insert thousands separators (e.g. 64,250.5).
    expect(display.primary.replace(/,/g, '')).toContain('64250.5')
    expect(
      display.fields.find((f) => f.label === 'Candle close')?.value.replace(/,/g, ''),
    ).toContain('64250.5')
    expect(display.fields.find((f) => f.label === 'Body / ATR')?.value).not.toBe('0')
  })

  it('uses candle close fallback only when closePrice absent but candle exists', () => {
    const event = {
      id: 'disp-legacy',
      kind: 'BEARISH_DISPLACEMENT' as const,
      candleIndex: 2,
      timestamp: 1,
      bodySize: 10,
      fullRange: 12,
      atr: 5,
      bodyAtrMultiple: 2,
      bodyToRangeRatio: 0.8,
      upperWick: 1,
      lowerWick: 1,
      structureBreakId: null,
      fvgId: null,
      reason: 'legacy',
      refs: [],
    }
    // Simulate missing closePrice on a legacy-shaped object.
    const display = getSmcEventDisplayValue(
      event as unknown as SmcDisplacementEvent,
      [candle(0, 100), candle(1, 101), candle(2, 99.25)],
    )
    expect(display.primary).toContain('99.25')
    expect(isArtificialZeroDisplay(display.primary)).toBe(false)
  })

  it('shows Unavailable for genuinely missing numeric fields, not 0', () => {
    const event = {
      id: 'disp-missing',
      kind: 'BULLISH_DISPLACEMENT' as const,
      candleIndex: 0,
      timestamp: 1,
      closePrice: Number.NaN,
      bodySize: Number.NaN,
      fullRange: Number.NaN,
      atr: Number.NaN,
      bodyAtrMultiple: Number.NaN,
      bodyToRangeRatio: Number.NaN,
      upperWick: Number.NaN,
      lowerWick: Number.NaN,
      structureBreakId: null,
      fvgId: null,
      reason: 'bad',
      refs: [],
    }
    const display = getSmcEventDisplayValue(event)
    expect(display.primary).not.toMatch(/^0(\.0+)?$/)
    expect(display.fields.every((f) => f.value !== '0')).toBe(true)
    expect(display.fields.some((f) => f.value === 'Unavailable')).toBe(true)
  })

  it('maps BOS to break close and broken level', () => {
    const display = getSmcEventDisplayValue({
      id: 'bos-1',
      kind: 'BULLISH_BOS',
      candleIndex: 5,
      timestamp: 1,
      closePrice: 110,
      brokenSwingId: 'sh-1',
      brokenSwingPrice: 100,
      brokenSwingTimestamp: 1,
      brokenSwingCandleIndex: 2,
      brokenSwingConfirmedAtIndex: 4,
      breakAmount: 10,
      breakPercent: 10,
      wickHigh: 111,
      wickLow: 105,
      wickOnlyIgnored: false,
      reason: 't',
      refs: [],
    })
    expect(display.primary).toContain('110')
    expect(display.primary).toContain('100')
  })
})
