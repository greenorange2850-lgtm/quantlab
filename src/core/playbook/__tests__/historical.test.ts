import { describe, expect, it } from 'vitest'
import type { Candle } from '@/data/candles'
import {
  BULLISH_CONTINUATION,
  BULLISH_QML_REVERSAL,
  defaultParameters,
  evaluateHistoricalPlaybook,
  evaluatePlaybookAt,
  replayPlaybook,
} from '../index.js'
import { demoPipelineResult } from '../demo.js'
import {
  bullishContinuationCandles,
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

describe('historical playbook evaluation', () => {
  it('propagates the source symbol and timeframe onto history and the latest evaluation', () => {
    const outcome = evaluateHistoricalPlaybook({
      playbookId: 'bullish-qml-reversal',
      parameters: defaultParameters(BULLISH_QML_REVERSAL),
      symbol: 'ETHUSDT',
      timeframe: '15m',
      candles: toQuantLab(bullishQmlCandles()),
    })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.meta.symbol).toBe('ETHUSDT')
    expect(outcome.meta.timeframe).toBe('15m')
    expect(outcome.result.history.symbol).toBe('ETHUSDT')
    expect(outcome.result.history.timeframe).toBe('15m')
    expect(outcome.result.evaluation.symbol).toBe('ETHUSDT')
    expect(outcome.result.evaluation.timeframe).toBe('15m')
    expect(outcome.meta.candleCount).toBe(bullishQmlCandles().length)
    expect(outcome.meta.replayCursor).toEqual({
      candleIndex: outcome.result.evaluation.candleIndex,
      timestamp: outcome.result.evaluation.timestamp,
      symbol: 'ETHUSDT',
      timeframe: '15m',
    })
  })

  it('is deterministic across repeated evaluations of the same series', () => {
    const input = {
      playbookId: 'bullish-qml-reversal',
      parameters: defaultParameters(BULLISH_QML_REVERSAL),
      symbol: 'XAUUSD',
      timeframe: '1h',
      candles: toQuantLab(bullishQmlCandles()),
    }
    const a = evaluateHistoricalPlaybook(input)
    const b = evaluateHistoricalPlaybook(input)
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    expect(a.result.history.evaluations.map((e) => e.serialized)).toEqual(
      b.result.history.evaluations.map((e) => e.serialized),
    )
  })

  it('has no look-ahead: a future candle change never alters an earlier snapshot', () => {
    const base = toQuantLab(bullishQmlCandles())
    const perturbed = base.map((c, i) =>
      i === base.length - 1 ? { ...c, close: 999, high: 999 } : c,
    )
    const params = defaultParameters(BULLISH_QML_REVERSAL)
    const a = evaluateHistoricalPlaybook({
      playbookId: 'bullish-qml-reversal',
      parameters: params,
      symbol: 'XAUUSD',
      timeframe: '1h',
      candles: base,
    })
    const b = evaluateHistoricalPlaybook({
      playbookId: 'bullish-qml-reversal',
      parameters: params,
      symbol: 'XAUUSD',
      timeframe: '1h',
      candles: perturbed,
    })
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    const early = a.result.history.evaluations[0]!
    const earlyPerturbed = b.result.history.evaluations[0]!
    expect(early.serialized).toBe(earlyPerturbed.serialized)
    expect(early.candleIndex).toBeLessThan(base.length - 1)

    const replayed = replayPlaybook(
      {
        candles: bullishQmlCandles(),
        events: [],
        definition: BULLISH_QML_REVERSAL,
        parameters: params,
        symbol: 'XAUUSD',
        timeframe: '1h',
      },
      early.candleIndex,
    )
    const direct = evaluatePlaybookAt({
      symbol: 'XAUUSD',
      timeframe: '1h',
      candles: bullishQmlCandles(),
      index: early.candleIndex,
      events: [],
      definition: BULLISH_QML_REVERSAL,
      parameters: params,
    })
    expect(replayed.serialized).toBe(direct.serialized)
  })

  it('does not silently fall back to demo BTCUSDT/1h when a real series is supplied', () => {
    const outcome = evaluateHistoricalPlaybook({
      playbookId: 'bullish-qml-reversal',
      parameters: defaultParameters(BULLISH_QML_REVERSAL),
      symbol: 'ETHUSDT',
      timeframe: '15m',
      candles: toQuantLab(bullishQmlCandles()),
    })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.result.evaluation.symbol).not.toBe('BTCUSDT')
    expect(outcome.result.evaluation.timeframe).not.toBe('1h')
  })

  it('exposes missing detector events for continuation without fabricating them', () => {
    const outcome = evaluateHistoricalPlaybook({
      playbookId: 'bullish-continuation',
      parameters: defaultParameters(BULLISH_CONTINUATION),
      symbol: 'ETHUSDT',
      timeframe: '1h',
      candles: toQuantLab(bullishContinuationCandles()),
      detectorEvents: [],
    })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.eventSupport.blocked).toBe(true)
    expect(outcome.result.evaluation.missingConditions).toContain('Valid BOS in trend direction')
    expect(outcome.result.eventsInScope).toBe(0)
  })

  it('uses supplied detector events for continuation instead of inventing them', () => {
    const outcome = evaluateHistoricalPlaybook({
      playbookId: 'bullish-continuation',
      parameters: defaultParameters(BULLISH_CONTINUATION),
      symbol: 'XAUUSD',
      timeframe: 'H1',
      candles: toQuantLab(bullishContinuationCandles()),
      detectorEvents: bullishContinuationEvents(),
    })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    expect(outcome.eventSupport.blocked).toBe(false)
    expect(outcome.result.evaluation.action).toBe('BUY')
  })

  it('rejects missing symbol and unknown timeframe instead of inventing them', () => {
    const candles = toQuantLab(bullishQmlCandles())
    const missingSymbol = evaluateHistoricalPlaybook({
      playbookId: 'bullish-qml-reversal',
      symbol: '  ',
      timeframe: '1h',
      candles,
    })
    expect(missingSymbol.ok).toBe(false)
    if (missingSymbol.ok) return
    expect(missingSymbol.error.code).toBe('missing_symbol')

    const missingTf = evaluateHistoricalPlaybook({
      playbookId: 'bullish-qml-reversal',
      symbol: 'ETHUSDT',
      timeframe: '',
      candles,
    })
    expect(missingTf.ok).toBe(false)
    if (missingTf.ok) return
    expect(missingTf.error.code).toBe('unknown_timeframe')
  })

  it('rejects an empty series and a series shorter than warmup', () => {
    const empty = evaluateHistoricalPlaybook({
      playbookId: 'bullish-qml-reversal',
      symbol: 'ETHUSDT',
      timeframe: '1h',
      candles: [],
    })
    expect(empty.ok).toBe(false)
    if (empty.ok) return
    expect(empty.error.code).toBe('missing_candles')

    const short = evaluateHistoricalPlaybook({
      playbookId: 'bullish-qml-reversal',
      symbol: 'ETHUSDT',
      timeframe: '1h',
      candles: toQuantLab(bullishQmlCandles()).slice(0, 5),
    })
    expect(short.ok).toBe(false)
    if (short.ok) return
    expect(short.error.code).toBe('insufficient_warmup')
  })

  it('leaves explicit demo mode functional and independent', () => {
    const demo = demoPipelineResult('bullish-qml-reversal')
    expect(demo.evaluation.symbol).toBe('BTCUSDT')
    expect(demo.evaluation.timeframe).toBe('1h')
    expect(demo.evaluation.status).toBe('READY')

    const historical = evaluateHistoricalPlaybook({
      playbookId: 'bullish-qml-reversal',
      symbol: 'ETHUSDT',
      timeframe: '15m',
      candles: toQuantLab(bullishQmlCandles()),
    })
    expect(historical.ok).toBe(true)
    if (!historical.ok) return
    expect(historical.result.evaluation.symbol).toBe('ETHUSDT')
    expect(demo.evaluation.symbol).toBe('BTCUSDT')
  })
})
