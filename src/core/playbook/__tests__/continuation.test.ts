import { describe, expect, it } from 'vitest'
import {
  BEARISH_CONTINUATION,
  BULLISH_CONTINUATION,
  defaultParameters,
  evaluatePlaybookAt,
} from '../index.js'
import {
  bearishContinuationCandles,
  bearishContinuationEvents,
  bullishContinuationCandles,
  bullishContinuationEvents,
} from './fixtures.js'

describe('continuation evaluation', () => {
  it('bullish: reaches READY/BUY with an alive FVG zone', () => {
    const candles = bullishContinuationCandles()
    const ev = evaluatePlaybookAt({
      symbol: 'XAUUSD',
      timeframe: 'H1',
      candles,
      index: candles.length - 1,
      events: bullishContinuationEvents(),
      definition: BULLISH_CONTINUATION,
      parameters: defaultParameters(BULLISH_CONTINUATION),
    })
    expect(ev.status).toBe('READY')
    expect(ev.action).toBe('BUY')
    expect(ev.direction).toBe('long')
    expect(ev.strength).toBe(81)
    expect(ev.missingConditions).toEqual([])
    expect(ev.zone!.kind).toBe('continuation')
    expect(ev.zone!.zone.top).toBeCloseTo(108.4, 1)
    expect(ev.zone!.zone.bottom).toBeCloseTo(107.5, 1)
    expect(ev.zone!.invalidated).toBe(false)
    for (const id of ['cont-bos', 'cont-zone', 'cont-zone-alive', 'cont-conflict']) {
      expect(ev.checks.find((c) => c.id === id)!.passed, `${id} should pass`).toBe(true)
    }
    // Event-driven check sources.
    expect(ev.checks.find((c) => c.id === 'cont-bos')!.source).toBe('event')
    expect(ev.checks.find((c) => c.id === 'cont-zone')!.source).toBe('event')
  })

  it('bearish: reaches READY/SELL with an alive OB zone', () => {
    const candles = bearishContinuationCandles()
    const ev = evaluatePlaybookAt({
      symbol: 'XAUUSD',
      timeframe: 'H1',
      candles,
      index: candles.length - 1,
      events: bearishContinuationEvents(),
      definition: BEARISH_CONTINUATION,
      parameters: defaultParameters(BEARISH_CONTINUATION),
    })
    expect(ev.status).toBe('READY')
    expect(ev.action).toBe('SELL')
    expect(ev.direction).toBe('short')
    expect(ev.zone!.zone.top).toBeCloseTo(92.4, 1)
    expect(ev.zone!.zone.bottom).toBeCloseTo(91.8, 1)
    expect(ev.entryZone!.kind).toBe('order_block')
    expect(ev.missingConditions).toEqual([])
  })

  it('requires a BOS event in the trend direction', () => {
    const candles = bullishContinuationCandles()
    const ev = evaluatePlaybookAt({
      symbol: 'XAUUSD',
      timeframe: 'H1',
      candles,
      index: candles.length - 1,
      events: [], // no BOS
      definition: BULLISH_CONTINUATION,
      parameters: defaultParameters(BULLISH_CONTINUATION),
    })
    expect(ev.status).toBe('WATCHING')
    expect(ev.action).toBe('NO_TRADE')
    expect(ev.missingConditions).toContain('Valid BOS in trend direction')
  })

  it('fails the zone checks when the zone is missing', () => {
    const candles = bullishContinuationCandles()
    // BOS present but no FVG/OB event.
    const ev = evaluatePlaybookAt({
      symbol: 'XAUUSD',
      timeframe: 'H1',
      candles,
      index: candles.length - 1,
      events: bullishContinuationEvents().filter((e) => e.ruleName === 'BOS'),
      definition: BULLISH_CONTINUATION,
      parameters: defaultParameters(BULLISH_CONTINUATION),
    })
    expect(ev.status).toBe('WATCHING')
    expect(ev.missingConditions).toContain('Active FVG/OB zone')
  })

  it('invalidates a continuation zone when price closes through the far side', () => {
    // Zone {108.4, 107.5}. Simulate a candle closing below 107.5 after the zone.
    const candles = bullishContinuationCandles()
    const modified = candles.map((c, i) => {
      if (i === 50) return { ...c, close: 107.0, low: 106.8, high: 108.2 }
      return c
    })
    const ev = evaluatePlaybookAt({
      symbol: 'XAUUSD',
      timeframe: 'H1',
      candles: modified,
      index: modified.length - 1,
      events: bullishContinuationEvents(),
      definition: BULLISH_CONTINUATION,
      parameters: defaultParameters(BULLISH_CONTINUATION),
    })
    expect(ev.zone!.invalidated).toBe(true)
    expect(ev.missingConditions).toContain('Zone alive')
  })

  it('promotes optional checks to required via parameter gates', () => {
    const candles = bullishContinuationCandles()
    const ev = evaluatePlaybookAt({
      symbol: 'XAUUSD',
      timeframe: 'H1',
      candles,
      index: candles.length - 1,
      events: bullishContinuationEvents(),
      definition: BULLISH_CONTINUATION,
      parameters: { ...defaultParameters(BULLISH_CONTINUATION), requireFreshZone: true },
    })
    // Fresh-zone (untouched) gate fails because the zone was touched once.
    expect(ev.missingConditions).toContain('Fresh zone')
    expect(ev.checks.find((c) => c.id === 'cont-fresh-zone')!.required).toBe(true)
  })
})
