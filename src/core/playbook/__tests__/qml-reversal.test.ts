import { describe, expect, it } from 'vitest'
import {
  BEARISH_QML_REVERSAL,
  BULLISH_QML_REVERSAL,
  defaultParameters,
  evaluatePlaybookAt,
  invariantFailuresFor,
} from '../index.js'
import { bearishQmlCandles, bullishQmlCandles } from './fixtures.js'

describe('QML reversal evaluation', () => {
  it('bullish: reaches READY/BUY with a broken-LH QML zone', () => {
    const candles = bullishQmlCandles()
    const ev = evaluatePlaybookAt({
      symbol: 'XAUUSD',
      timeframe: 'H1',
      candles,
      index: candles.length - 1,
      events: [],
      definition: BULLISH_QML_REVERSAL,
      parameters: defaultParameters(BULLISH_QML_REVERSAL),
    })
    expect(ev.status).toBe('READY')
    expect(ev.action).toBe('BUY')
    expect(ev.direction).toBe('long')
    expect(ev.strength).toBe(72)
    expect(ev.missingConditions).toEqual([])

    // Broken swing (lower high) becomes the QML zone — never arbitrary candles.
    expect(ev.zone).not.toBeNull()
    expect(ev.zone!.kind).toBe('qml')
    expect(ev.zone!.zone.top).toBeCloseTo(99.4, 1)
    expect(ev.zone!.zone.bottom).toBeCloseTo(91.6, 1)
    expect(ev.zone!.touchedCount).toBeLessThanOrEqual(3)
    expect(ev.zone!.invalidated).toBe(false)
    expect(ev.zone!.expired).toBe(false)

    // Required checks all pass.
    for (const id of ['qml-context', 'qml-lh-ll', 'qml-break', 'qml-choch', 'qml-zone', 'qml-retest']) {
      const check = ev.checks.find((c) => c.id === id)!
      expect(check.passed, `${id} should pass`).toBe(true)
    }

    // Levels derived from the zone.
    expect(ev.entryZone!.zone).toEqual(ev.zone!.zone)
    expect(ev.stopReference!.price).toBeCloseTo(91.6, 1)
    expect(ev.targets.length).toBeGreaterThanOrEqual(1)
    expect(ev.targets[0].kind).toBe('rr')
    expect(ev.nextExpectedEvent?.label).toBe('Entry trigger')
    expect(invariantFailuresFor(ev)).toEqual([])
  })

  it('bearish: reaches READY/SELL with a broken-HL QML zone', () => {
    const candles = bearishQmlCandles()
    const ev = evaluatePlaybookAt({
      symbol: 'XAUUSD',
      timeframe: 'H1',
      candles,
      index: candles.length - 1,
      events: [],
      definition: BEARISH_QML_REVERSAL,
      parameters: defaultParameters(BEARISH_QML_REVERSAL),
    })
    expect(ev.status).toBe('READY')
    expect(ev.action).toBe('SELL')
    expect(ev.direction).toBe('short')
    expect(ev.strength).toBe(72)
    expect(ev.missingConditions).toEqual([])
    expect(ev.zone!.kind).toBe('qml')
    expect(ev.zone!.zone.top).toBeCloseTo(108.4, 1)
    expect(ev.zone!.zone.bottom).toBeCloseTo(100.6, 1)
    expect(ev.stopReference!.price).toBeCloseTo(108.4, 1)
    expect(ev.targets[0].kind).toBe('rr')
    expect(invariantFailuresFor(ev)).toEqual([])
  })

  it('walks the status lifecycle: WATCHING → WAITING_RETEST → READY', () => {
    const candles = bullishQmlCandles()
    const params = defaultParameters(BULLISH_QML_REVERSAL)
    const seen: string[] = []
    for (let i = 0; i < candles.length; i++) {
      const ev = evaluatePlaybookAt({
        symbol: 'XAUUSD',
        timeframe: 'H1',
        candles,
        index: i,
        events: [],
        definition: BULLISH_QML_REVERSAL,
        parameters: params,
      })
      if (seen[seen.length - 1] !== ev.status) seen.push(ev.status)
    }
    expect(seen).toEqual(['WATCHING', 'WAITING_RETEST', 'READY'])
  })

  it('bullish: holds WAITING_RETEST before the retest happens', () => {
    const candles = bullishQmlCandles()
    const params = defaultParameters(BULLISH_QML_REVERSAL)
    // The zone forms on bar 52; the retest is later (around bar 58). Before the
    // retest the status must be WAITING_RETEST with a WAIT action.
    const ev = evaluatePlaybookAt({
      symbol: 'XAUUSD',
      timeframe: 'H1',
      candles,
      index: 55,
      events: [],
      definition: BULLISH_QML_REVERSAL,
      parameters: params,
    })
    expect(ev.status).toBe('WAITING_RETEST')
    expect(ev.action).toBe('WAIT')
    expect(ev.missingConditions).toEqual(['Later retest of QML zone'])
    expect(ev.nextExpectedEvent?.label).toBe('Retest of the zone')
  })

  it('bullish: is WATCHING before any broken swing exists', () => {
    const candles = bullishQmlCandles()
    const ev = evaluatePlaybookAt({
      symbol: 'XAUUSD',
      timeframe: 'H1',
      candles,
      index: 20,
      events: [],
      definition: BULLISH_QML_REVERSAL,
      parameters: defaultParameters(BULLISH_QML_REVERSAL),
    })
    expect(ev.status).toBe('WATCHING')
    expect(ev.action).toBe('NO_TRADE')
    expect(ev.zone).toBeNull()
  })

  it('requires a later retest: retest must occur after the break candle', () => {
    const candles = bullishQmlCandles()
    const params = defaultParameters(BULLISH_QML_REVERSAL)
    const ev = evaluatePlaybookAt({
      symbol: 'XAUUSD',
      timeframe: 'H1',
      candles,
      index: 52, // break candle itself — no retest yet possible
      events: [],
      definition: BULLISH_QML_REVERSAL,
      parameters: params,
    })
    expect(ev.missingConditions).toContain('Later retest of QML zone')
  })

  it('fails READY when a required parameter gate (requireSweep) is unsatisfied', () => {
    const candles = bullishQmlCandles()
    const ev = evaluatePlaybookAt({
      symbol: 'XAUUSD',
      timeframe: 'H1',
      candles,
      index: candles.length - 1,
      events: [],
      definition: BULLISH_QML_REVERSAL,
      parameters: { ...defaultParameters(BULLISH_QML_REVERSAL), requireSweep: true },
    })
    // Zone is formed and retested, but the promoted sweep gate blocks READY.
    expect(ev.status).toBe('WATCHING')
    expect(ev.missingConditions).toContain('Sell-side liquidity sweep')
  })

  it('is deterministic: two evaluations of the same bar are byte-identical', () => {
    const candles = bullishQmlCandles()
    const params = defaultParameters(BULLISH_QML_REVERSAL)
    const opts = {
      symbol: 'XAUUSD',
      timeframe: 'H1',
      candles,
      index: candles.length - 1,
      events: [] as never[],
      definition: BULLISH_QML_REVERSAL,
      parameters: params,
    }
    const a = evaluatePlaybookAt(opts as never)
    const b = evaluatePlaybookAt(opts as never)
    expect(a.serialized).toBe(b.serialized)
  })
})
