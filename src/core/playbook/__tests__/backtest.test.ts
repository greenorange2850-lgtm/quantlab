import { describe, expect, it } from 'vitest'
import {
  BULLISH_CONTINUATION,
  BULLISH_QML_REVERSAL,
  applyLifecycleOutcomes,
  defaultParameters,
  evaluatePlaybookAt,
  evaluatePlaybookHistory,
  replayPlaybook,
  scoreHistory,
  warmupIndex,
} from '../index.js'
import {
  bearishQmlCandles,
  buildLegs,
  bullishContinuationCandles,
  bullishContinuationEvents,
  bullishQmlCandles,
} from './fixtures.js'

describe('playbook backtest / replay', () => {
  it('replay of a single point matches the history snapshot exactly', () => {
    const candles = bullishQmlCandles()
    const options = {
      candles,
      events: [] as never[],
      definition: BULLISH_QML_REVERSAL,
      parameters: defaultParameters(BULLISH_QML_REVERSAL),
      symbol: 'XAUUSD',
      timeframe: 'H1',
    }
    const raw = evaluatePlaybookHistory({ ...options, lifecycle: false })
    for (let j = 0; j < raw.evaluations.length; j++) {
      const snap = raw.evaluations[j]
      const rep = replayPlaybook(options, snap.candleIndex)
      expect(rep.serialized, `replay at candle ${snap.candleIndex}`).toBe(snap.serialized)
    }
  })

  it('is deterministic across two full-history runs', () => {
    const options = {
      candles: bullishQmlCandles(),
      events: [] as never[],
      definition: BULLISH_QML_REVERSAL,
      parameters: defaultParameters(BULLISH_QML_REVERSAL),
      symbol: 'XAUUSD',
      timeframe: 'H1',
    }
    const a = evaluatePlaybookHistory(options)
    const b = evaluatePlaybookHistory(options)
    expect(a.evaluations.map((e) => e.serialized)).toEqual(b.evaluations.map((e) => e.serialized))
  })

  it('has no look-ahead: a future candle change never alters an earlier evaluation', () => {
    const base = bullishQmlCandles()
    const perturbed = base.map((c, i) => (i === base.length - 1 ? { ...c, close: 999, high: 999 } : c))
    const params = defaultParameters(BULLISH_QML_REVERSAL)
    const at = 40 // well before the break/retest
    const a = evaluatePlaybookAt({
      symbol: 'XAUUSD',
      timeframe: 'H1',
      candles: base,
      index: at,
      events: [],
      definition: BULLISH_QML_REVERSAL,
      parameters: params,
    })
    const b = evaluatePlaybookAt({
      symbol: 'XAUUSD',
      timeframe: 'H1',
      candles: perturbed,
      index: at,
      events: [],
      definition: BULLISH_QML_REVERSAL,
      parameters: params,
    })
    expect(a.serialized).toBe(b.serialized)
  })

  it('concludes a READY setup as COMPLETED when the first target is hit', () => {
    const options = {
      candles: bullishContinuationCandles(),
      events: bullishContinuationEvents(),
      definition: BULLISH_CONTINUATION,
      parameters: defaultParameters(BULLISH_CONTINUATION),
      symbol: 'XAUUSD',
      timeframe: 'H1',
    }
    const result = evaluatePlaybookHistory(options)
    expect(result.completedCount).toBeGreaterThanOrEqual(1)
    const concluded = result.evaluations.find((e) => e.status === 'COMPLETED')
    expect(concluded).toBeTruthy()
    expect(concluded!.action).toBe('NO_TRADE')
    expect(concluded!.nextExpectedEvent).toBeNull()
    expect(concluded!.explanation).toContain('Outcome: First target')
  })

  it('concludes a READY setup as INVALIDATED when the stop is hit', () => {
    const base = bullishQmlCandles()
    const last = base[base.length - 1]
    const crash = [...base, ...buildLegs([104, 86], 8, Date.parse(last.timestamp) + 3_600_000)]
    const result = evaluatePlaybookHistory({
      candles: crash,
      events: [],
      definition: BULLISH_QML_REVERSAL,
      parameters: defaultParameters(BULLISH_QML_REVERSAL),
      symbol: 'XAUUSD',
      timeframe: 'H1',
    })
    expect(result.invalidatedCount).toBeGreaterThanOrEqual(1)
    const concluded = result.evaluations.find((e) => e.status === 'INVALIDATED')
    expect(concluded).toBeTruthy()
    expect(concluded!.explanation).toContain('Outcome: Stop hit')
  })

  it('concludes a READY setup as EXPIRED when neither target nor stop is reached', () => {
    const base = bullishQmlCandles()
    const last = base[base.length - 1]
    const flat = [...base, ...buildLegs([104, 103], 25, Date.parse(last.timestamp) + 3_600_000)]
    const result = evaluatePlaybookHistory({
      candles: flat,
      events: [],
      definition: BULLISH_QML_REVERSAL,
      parameters: defaultParameters(BULLISH_QML_REVERSAL),
      symbol: 'XAUUSD',
      timeframe: 'H1',
    })
    expect(result.expiredCount).toBeGreaterThanOrEqual(1)
    const concluded = result.evaluations.find((e) => e.status === 'EXPIRED')
    expect(concluded!.explanation).toContain('Outcome:')
  })

  it('lifecycle post-pass is idempotent on the same snapshot set', () => {
    const candles = bullishQmlCandles()
    const params = defaultParameters(BULLISH_QML_REVERSAL)
    const raw = evaluatePlaybookHistory({
      candles,
      events: [],
      definition: BULLISH_QML_REVERSAL,
      parameters: params,
      lifecycle: false,
    })
    const once = applyLifecycleOutcomes(raw.evaluations, candles, params)
    const twice = applyLifecycleOutcomes(once, candles, params)
    // Terminal conclusions must not be re-advanced.
    expect(twice.map((e) => e.status)).toEqual(once.map((e) => e.status))
  })

  it('computes a deterministic score for random search', () => {
    const options = {
      candles: bullishQmlCandles(),
      events: [] as never[],
      definition: BULLISH_QML_REVERSAL,
      parameters: defaultParameters(BULLISH_QML_REVERSAL),
      symbol: 'XAUUSD',
      timeframe: 'H1',
    }
    const a = scoreHistory(evaluatePlaybookHistory(options))
    const b = scoreHistory(evaluatePlaybookHistory(options))
    expect(a).toBe(b)
    expect(Number.isFinite(a)).toBe(true)
    // More READY setups ⇒ strictly higher score.
    const contOptions = {
      candles: bullishContinuationCandles(),
      events: bullishContinuationEvents(),
      definition: BULLISH_CONTINUATION,
      parameters: defaultParameters(BULLISH_CONTINUATION),
      symbol: 'XAUUSD',
      timeframe: 'H1',
    }
    const contScore = scoreHistory(evaluatePlaybookHistory(contOptions))
    expect(a).toBeGreaterThan(contScore)
  })

  it('warmup index derives from the swing lookback parameter', () => {
    const p = defaultParameters(BULLISH_QML_REVERSAL)
    expect(warmupIndex(BULLISH_QML_REVERSAL, p)).toBe(12)
    expect(warmupIndex(BULLISH_QML_REVERSAL, { ...p, swingLookback: 8 })).toBe(18)
  })

  it('summarizes status counts consistently', () => {
    const candles = bearishQmlCandles()
    const result = evaluatePlaybookHistory({
      candles,
      events: [],
      definition: BULLISH_QML_REVERSAL,
      parameters: { ...defaultParameters(BULLISH_QML_REVERSAL), maxZoneAge: 100 },
      symbol: 'XAUUSD',
      timeframe: 'H1',
    })
    const sum =
      result.readies +
      result.watchCount +
      result.waitRetestCount +
      result.invalidatedCount +
      result.completedCount +
      result.expiredCount
    expect(sum).toBe(result.evaluations.length)
  })
})
