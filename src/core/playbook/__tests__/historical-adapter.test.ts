import { describe, expect, it } from 'vitest'
import type { Candle } from '@/data/candles'
import {
  adaptHistoricalCandle,
  adaptHistoricalCandles,
  adaptHistoricalDetectorEvents,
  HistoricalCandleAdapterError,
  inspectPlaybookEventSupport,
  PLAYBOOK_EVENT_REQUIREMENTS,
  toPlaybookCandle,
} from '../index.js'
import {
  bullishContinuationEvents,
  bullishQmlCandles,
} from './fixtures.js'

function toQuantLab(candles: ReturnType<typeof bullishQmlCandles>): Candle[] {
  return candles.map((c) => ({
    time: Date.parse(c.timestamp),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  }))
}

describe('historical candle adapter', () => {
  it('converts QuantLab/replay candles into PlaybookCandle[] without reordering', () => {
    const source = toQuantLab(bullishQmlCandles())
    const adapted = adaptHistoricalCandles(source)
    expect(adapted).toHaveLength(source.length)
    for (let i = 0; i < source.length; i++) {
      expect(adapted[i]).toEqual(toPlaybookCandle(source[i]!))
      expect(adapted[i]!.timestamp).toBe(new Date(source[i]!.time).toISOString())
      expect(adapted[i]!.open).toBe(source[i]!.open)
      expect(adapted[i]!.high).toBe(source[i]!.high)
      expect(adapted[i]!.low).toBe(source[i]!.low)
      expect(adapted[i]!.close).toBe(source[i]!.close)
      expect(adapted[i]!.volume).toBe(source[i]!.volume)
    }
  })

  it('is deterministic for the same input', () => {
    const source = toQuantLab(bullishQmlCandles())
    expect(adaptHistoricalCandles(source)).toEqual(adaptHistoricalCandles(source))
  })

  it('preserves replay candleIndex as array position', () => {
    const source = toQuantLab(bullishQmlCandles())
    const adapted = adaptHistoricalCandles(source)
    expect(adapted[17]!.timestamp).toBe(new Date(source[17]!.time).toISOString())
    expect(adaptHistoricalCandle(source[17]!, 17)).toEqual(adapted[17])
  })

  it('rejects non-finite OHLCV instead of dropping the bar (index-preserving)', () => {
    const source = toQuantLab(bullishQmlCandles())
    source[3] = { ...source[3]!, close: Number.NaN }
    expect(() => adaptHistoricalCandles(source)).toThrow(HistoricalCandleAdapterError)
    try {
      adaptHistoricalCandles(source)
    } catch (err) {
      expect(err).toBeInstanceOf(HistoricalCandleAdapterError)
      expect((err as HistoricalCandleAdapterError).candleIndex).toBe(3)
    }
  })
})

describe('historical detector event adapter', () => {
  it('passes through existing playbook/detector events', () => {
    const events = bullishContinuationEvents()
    const adapted = adaptHistoricalDetectorEvents(events)
    expect(adapted.events).toEqual(events)
    expect(adapted.ignoredExecutionEvents).toBe(0)
    expect(adapted.rejectedCount).toBe(0)
  })

  it('does not convert backtest execution events into detector events', () => {
    const adapted = adaptHistoricalDetectorEvents([
      {
        id: 'ex-1',
        kind: 'signal_evaluated',
        candleIndex: 4,
        candleTime: 1_700_000_000_000,
        signal: 'BUY',
        reason: null,
        stopLossPrice: null,
        takeProfitPrice: null,
        positionBefore: 'flat',
        positionAfter: 'flat',
        skipReason: null,
        tradeId: null,
        fillPrice: null,
        fillQuantity: null,
        commission: null,
        pnl: null,
        rsiConfirmationFailed: null,
      },
    ])
    expect(adapted.events).toEqual([])
    expect(adapted.ignoredExecutionEvents).toBe(1)
    expect(adapted.rejectedCount).toBe(0)
  })

  it('treats missing events as empty rather than fabricating them', () => {
    expect(adaptHistoricalDetectorEvents(undefined).events).toEqual([])
    expect(adaptHistoricalDetectorEvents(null).events).toEqual([])
    expect(adaptHistoricalDetectorEvents([]).events).toEqual([])
  })
})

describe('playbook event requirements', () => {
  it('documents QML as candle-only and continuation as event-required', () => {
    expect(PLAYBOOK_EVENT_REQUIREMENTS['qml-reversal'].candleOnly).toBe(true)
    expect(PLAYBOOK_EVENT_REQUIREMENTS.continuation.candleOnly).toBe(false)
    expect(PLAYBOOK_EVENT_REQUIREMENTS.continuation.requiredRuleNames).toContain('BOS')
  })

  it('flags continuation as blocked when detector events are absent', () => {
    const inspection = inspectPlaybookEventSupport('continuation', [])
    expect(inspection.blocked).toBe(true)
    expect(inspection.detail).toMatch(/not fabricated/i)
  })

  it('does not block QML when detector events are absent', () => {
    const inspection = inspectPlaybookEventSupport('qml-reversal', [])
    expect(inspection.blocked).toBe(false)
    expect(inspection.requirement.candleOnly).toBe(true)
  })
})
