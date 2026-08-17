import { describe, expect, it } from 'vitest'
import {
  BULLISH_QML_REVERSAL,
  collectDiagnostics,
  defaultParameters,
  evaluatePlaybookAt,
  evaluateInvariants,
  invariantFailuresFor,
} from '../index.js'
import { bullishQmlCandles } from './fixtures.js'

function bullishEvaluation() {
  const candles = bullishQmlCandles()
  return evaluatePlaybookAt({
    symbol: 'XAUUSD',
    timeframe: 'H1',
    candles,
    index: candles.length - 1,
    events: [],
    definition: BULLISH_QML_REVERSAL,
    parameters: defaultParameters(BULLISH_QML_REVERSAL),
  })
}

describe('playbook diagnostics', () => {
  it('returns an empty diagnostics for no evaluations', () => {
    const d = collectDiagnostics([])
    expect(d.totalEvaluations).toBe(0)
    expect(d.invariantFailures).toEqual([])
    expect(d.byStatus.READY).toBe(0)
  })

  it('aggregates status counts and strength stats over a history', () => {
    const candles = bullishQmlCandles()
    const raw = candles.map((_, index) =>
      evaluatePlaybookAt({
        symbol: 'XAUUSD',
        timeframe: 'H1',
        candles,
        index,
        events: [],
        definition: BULLISH_QML_REVERSAL,
        parameters: defaultParameters(BULLISH_QML_REVERSAL),
      }),
    )
    const d = collectDiagnostics(raw)
    expect(d.totalEvaluations).toBe(candles.length)
    expect(d.byStatus.READY).toBe(d.readyCount)
    expect(d.byStatus.WAITING_RETEST).toBe(d.waitingRetestCount)
    expect(d.byStatus.WATCHING).toBe(d.watchingCount)
    expect(d.averageStrength).toBeGreaterThan(0)
    expect(d.maxStrength).toBeGreaterThanOrEqual(d.minStrength)
    expect(d.strongest).not.toBeNull()
    expect(d.weakest).not.toBeNull()
    // READY evaluations dominate the tail; earlier bars contribute missing checks.
    expect(d.readyCount).toBeGreaterThan(0)
    expect(d.missingConditions['Later retest of QML zone']).toBeGreaterThan(0)
    expect(d.invariantFailures).toEqual([])
  })

  it('keeps strength within [0, 100] for every evaluation', () => {
    const candles = bullishQmlCandles()
    for (let i = 0; i < candles.length; i++) {
      const ev = evaluatePlaybookAt({
        symbol: 'XAUUSD',
        timeframe: 'H1',
        candles,
        index: i,
        events: [],
        definition: BULLISH_QML_REVERSAL,
        parameters: defaultParameters(BULLISH_QML_REVERSAL),
      })
      expect(ev.strength).toBeGreaterThanOrEqual(0)
      expect(ev.strength).toBeLessThanOrEqual(100)
    }
  })

  it('invariants pass for a valid READY evaluation', () => {
    expect(invariantFailuresFor(bullishEvaluation())).toEqual([])
  })

  it('invariants flag an out-of-range strength', () => {
    const ev = { ...bullishEvaluation(), strength: 150 }
    const failures = evaluateInvariants([ev])
    expect(failures.some((f) => f.includes('strength 150 outside'))).toBe(true)
  })

  it('invariants flag terminal statuses with a next expected event', () => {
    const ev = { ...bullishEvaluation(), status: 'COMPLETED' as const, nextExpectedEvent: { label: 'Entry trigger' } }
    const failures = evaluateInvariants([ev])
    expect(failures.some((f) => f.includes('terminal status with a next expected event'))).toBe(true)
  })

  it('invariants flag a long stop that sits above the entry zone', () => {
    const base = bullishEvaluation()
    const ev = {
      ...base,
      direction: 'long' as const,
      stopReference: { price: 100, kind: 'zone_beyond' as const, label: 'bad stop' },
    }
    const failures = evaluateInvariants([ev])
    expect(failures.some((f) => f.includes('long stop not below entry zone'))).toBe(true)
  })

  it('invariants flag malformed serialized payloads', () => {
    const ev = { ...bullishEvaluation(), serialized: '{not json' }
    const failures = evaluateInvariants([ev])
    expect(failures.some((f) => f.includes('serialized payload not valid JSON'))).toBe(true)
  })

  it('invariants flag out-of-order event chains', () => {
    const base = bullishEvaluation()
    const ev = {
      ...base,
      eventChain: [
        { label: 'A', timestamp: 'x', candleIndex: 10 },
        { label: 'B', timestamp: 'x', candleIndex: 5 },
      ],
    }
    const failures = evaluateInvariants([ev])
    expect(failures.some((f) => f.includes('event chain out of order'))).toBe(true)
  })
})
