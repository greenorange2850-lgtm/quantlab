import { describe, expect, it } from 'vitest'
import {
  BULLISH_CONTINUATION,
  BULLISH_QML_REVERSAL,
  defaultParameters,
  evaluatePlaybookHistory,
  type PlaybookCheck,
  type PlaybookEvaluation,
} from '@/core/playbook'
import {
  bearishQmlCandles,
  bullishContinuationCandles,
  bullishContinuationEvents,
  bullishQmlCandles,
} from '@/core/playbook/__tests__/fixtures'
import {
  adjacentSetupIndex,
  buildPlaybookReplayMarkers,
  buildPlaybookReplayOverlay,
  clampSetupIndex,
  extractLifecycleOutcome,
  findSetupIndexByCandle,
  isLifecycleOutcomeVisible,
  parsePlaybookReplaySearch,
  playbookChartPresentation,
  playbookMarkersVisibleAtCursor,
  playbookReplaySearch,
  replayCursorForSetup,
  replayPageQueryIsValid,
  selectedPlaybookSetupView,
  selectPlaybookStateTransitions,
} from '../replay-markers'

function check(id: string, required: boolean, passed: boolean): PlaybookCheck {
  return { id, label: id, required, passed }
}

function evaluation(overrides: Partial<PlaybookEvaluation>): PlaybookEvaluation {
  return {
    id: overrides.id ?? `e-${overrides.candleIndex ?? 0}`,
    playbookId: 'bullish-qml-reversal',
    playbookVersion: '1.0.0',
    symbol: 'ETHUSDT',
    timeframe: '15m',
    timestamp: overrides.timestamp ?? '2024-01-01T00:00:00.000Z',
    candleIndex: 0,
    direction: 'long',
    status: 'WATCHING',
    action: 'WAIT',
    strength: 20,
    checks: [],
    requiredChecks: [check('qml-context', true, false)],
    optionalChecks: [check('qml-fvg', false, false)],
    missingConditions: [],
    warnings: [],
    entryZone: null,
    stopReference: null,
    targets: [],
    eventChain: [],
    nextExpectedEvent: null,
    zone: null,
    explanation: 'watching structure',
    parameters: {},
    diagnostics: { evaluationDurationMs: 0, structureDurationMs: 0, eventDurationMs: 0 },
    serialized: '{}',
    ...overrides,
  }
}

describe('playbook replay marker mapping', () => {
  it('maps evaluation fields onto a replay marker', () => {
    const setup = evaluation({
      candleIndex: 42,
      timestamp: '2024-03-01T12:00:00.000Z',
      status: 'READY',
      action: 'BUY',
      strength: 72,
      explanation: 'zone retested',
      stopReference: { price: 91.6, kind: 'zone_beyond', label: 'Below QML zone' },
      targets: [{ order: 1, price: 115, kind: 'rr', label: 'RR 2' }],
    })
    const markers = buildPlaybookReplayMarkers({
      setupEvaluations: [setup],
      playbookName: 'Bullish QML Reversal',
      candleTimeByIndex: new Map([[42, 1_709_294_400_000]]),
    })
    expect(markers).toHaveLength(1)
    expect(markers[0]).toMatchObject({
      playbookId: 'bullish-qml-reversal',
      playbookVersion: '1.0.0',
      playbookName: 'Bullish QML Reversal',
      candleIndex: 42,
      timestamp: '2024-03-01T12:00:00.000Z',
      timeMs: 1_709_294_400_000,
      setupStatus: 'READY',
      action: 'BUY',
      direction: 'long',
      strength: 72,
      explanation: 'zone retested',
      symbol: 'ETHUSDT',
      timeframe: '15m',
    })
    expect(markers[0]!.stopReference?.price).toBe(91.6)
    expect(markers[0]!.targets[0]?.price).toBe(115)
    expect(markers[0]!.lifecycleOutcome).toBeNull()
  })

  it('keeps only status transitions instead of every candle', () => {
    const evals = [
      evaluation({ candleIndex: 10, status: 'WATCHING' }),
      evaluation({ candleIndex: 11, status: 'WATCHING' }),
      evaluation({ candleIndex: 12, status: 'WATCHING' }),
      evaluation({ candleIndex: 20, status: 'WAITING_RETEST', action: 'WAIT' }),
      evaluation({ candleIndex: 21, status: 'WAITING_RETEST', action: 'WAIT' }),
      evaluation({ candleIndex: 30, status: 'READY', action: 'BUY', strength: 70 }),
      evaluation({ candleIndex: 31, status: 'READY', action: 'BUY', strength: 70 }),
    ]
    const transitions = selectPlaybookStateTransitions(evals)
    expect(transitions.map((e) => [e.candleIndex, e.status])).toEqual([
      [10, 'WATCHING'],
      [20, 'WAITING_RETEST'],
      [30, 'READY'],
    ])
    expect(buildPlaybookReplayMarkers({ setupEvaluations: evals })).toHaveLength(3)
  })

  it('maps COMPLETED, INVALIDATED, and EXPIRED when they are live setup transitions', () => {
    const evals = [
      evaluation({ candleIndex: 10, status: 'WATCHING' }),
      evaluation({ candleIndex: 20, status: 'READY', action: 'BUY' }),
      evaluation({ candleIndex: 28, status: 'INVALIDATED', action: 'NO_TRADE' }),
      evaluation({ candleIndex: 40, status: 'EXPIRED', action: 'NO_TRADE' }),
    ]
    expect(selectPlaybookStateTransitions(evals).map((e) => e.status)).toEqual([
      'WATCHING',
      'READY',
      'INVALIDATED',
      'EXPIRED',
    ])
  })

  it('attaches lifecycle outcome separately from the original READY setup state', () => {
    const setup = evaluation({
      candleIndex: 30,
      status: 'READY',
      action: 'BUY',
      explanation: 'Bullish QML Reversal: zone retested',
    })
    const outcome = evaluation({
      candleIndex: 30,
      status: 'COMPLETED',
      action: 'NO_TRADE',
      explanation: 'Bullish QML Reversal: zone retested Outcome: First target 115.00000 reached.',
    })
    expect(extractLifecycleOutcome(setup, outcome)).toEqual({
      status: 'COMPLETED',
      reason: 'First target 115.00000 reached',
    })
    const markers = buildPlaybookReplayMarkers({
      setupEvaluations: [setup],
      outcomeEvaluations: [outcome],
    })
    expect(markers[0]!.setupStatus).toBe('READY')
    expect(markers[0]!.action).toBe('BUY')
    expect(markers[0]!.explanation).toBe('Bullish QML Reversal: zone retested')
    expect(markers[0]!.lifecycleOutcome).toEqual({
      status: 'COMPLETED',
      reason: 'First target 115.00000 reached',
    })
  })

  it('maps QML history candleIndex/timestamp onto replay markers', () => {
    const candles = bullishQmlCandles()
    const overlay = buildPlaybookReplayOverlay({
      playbookId: 'bullish-qml-reversal',
      parameters: defaultParameters(BULLISH_QML_REVERSAL),
      symbol: 'ETHUSDT',
      timeframe: '1h',
      candles: candles.map((c) => ({
        time: Date.parse(c.timestamp),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      })),
    })
    expect(overlay.markers.map((m) => m.setupStatus)).toEqual([
      'WATCHING',
      'WAITING_RETEST',
      'READY',
    ])
    for (const marker of overlay.markers) {
      expect(marker.symbol).toBe('ETHUSDT')
      expect(marker.timeframe).toBe('1h')
      expect(marker.timestamp).toBe(candles[marker.candleIndex]!.timestamp)
      expect(marker.timeMs).toBe(Date.parse(candles[marker.candleIndex]!.timestamp))
    }
  })

  it('does not rewrite READY into COMPLETED on the setup marker', () => {
    const candles = bullishContinuationCandles()
    const overlay = buildPlaybookReplayOverlay({
      playbookId: 'bullish-continuation',
      parameters: defaultParameters(BULLISH_CONTINUATION),
      symbol: 'XAUUSD',
      timeframe: 'H1',
      candles: candles.map((c) => ({
        time: Date.parse(c.timestamp),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      })),
      detectorEvents: bullishContinuationEvents(),
    })
    const ready = overlay.markers.find((m) => m.setupStatus === 'READY')
    expect(ready).toBeTruthy()
    expect(ready!.action).toBe('BUY')
    const concluded = overlay.outcomeHistory.evaluations.find((e) => e.status === 'COMPLETED')
    expect(concluded).toBeTruthy()
    expect(ready!.lifecycleOutcome?.status).toBe('COMPLETED')
    expect(ready!.setupStatus).toBe('READY')
  })
})

describe('playbook replay navigation', () => {
  const markers = buildPlaybookReplayMarkers({
    setupEvaluations: [
      evaluation({ candleIndex: 10, status: 'WATCHING' }),
      evaluation({ candleIndex: 20, status: 'WAITING_RETEST' }),
      evaluation({ candleIndex: 30, status: 'READY', action: 'BUY' }),
    ],
  })

  it('clamps and steps previous/next/first/last', () => {
    expect(clampSetupIndex(-2, 3)).toBe(0)
    expect(clampSetupIndex(9, 3)).toBe(2)
    expect(adjacentSetupIndex(1, 3, -1)).toBe(0)
    expect(adjacentSetupIndex(1, 3, 1)).toBe(2)
    expect(adjacentSetupIndex(0, 3, -1)).toBe(0)
    expect(adjacentSetupIndex(2, 3, 1)).toBe(2)
  })

  it('focuses the setup at or before a candle index', () => {
    expect(findSetupIndexByCandle(markers, 20)).toBe(1)
    expect(findSetupIndexByCandle(markers, 24)).toBe(1)
    expect(findSetupIndexByCandle(markers, 30)).toBe(2)
    expect(findSetupIndexByCandle(markers, 5)).toBe(0)
    expect(findSetupIndexByCandle([], 10)).toBe(-1)
  })

  it('jumps the replay cursor onto the selected setup candle', () => {
    const ready = markers[2]!
    expect(replayCursorForSetup(ready)).toEqual({
      cursorIndex: 30,
      mode: 'replay',
      playing: false,
    })
    expect(replayCursorForSetup(ready).cursorIndex).toBe(ready.candleIndex)
  })
})

describe('playbook replay look-ahead', () => {
  const markers = buildPlaybookReplayMarkers({
    setupEvaluations: [
      evaluation({ candleIndex: 10, status: 'WATCHING' }),
      evaluation({ candleIndex: 20, status: 'WAITING_RETEST' }),
      evaluation({ candleIndex: 30, status: 'READY', action: 'BUY' }),
    ],
  })

  it('hides future setups while the replay cursor is earlier', () => {
    expect(playbookMarkersVisibleAtCursor(markers, 15, 'replay')).toHaveLength(1)
    expect(playbookMarkersVisibleAtCursor(markers, 20, 'replay').map((m) => m.setupStatus)).toEqual([
      'WATCHING',
      'WAITING_RETEST',
    ])
    expect(playbookMarkersVisibleAtCursor(markers, 30, 'replay')).toHaveLength(3)
    expect(playbookMarkersVisibleAtCursor(markers, null, 'full')).toHaveLength(3)
  })

  it('keeps lifecycle outcome off the live replay status', () => {
    expect(isLifecycleOutcomeVisible('replay')).toBe(false)
    expect(isLifecycleOutcomeVisible('full')).toBe(true)
  })

  it('hides future markers and outcome glyphs during replay presentation', () => {
    const presentation = playbookChartPresentation(markers, 20, 'replay')
    expect(presentation.markers.map((m) => m.setupStatus)).toEqual(['WATCHING', 'WAITING_RETEST'])
    expect(presentation.showLifecycleOutcome).toBe(false)
    expect(playbookChartPresentation(markers, 30, 'full').showLifecycleOutcome).toBe(true)
  })

  it('keeps the selected-setup panel on original READY state while outcome is hidden in replay', () => {
    const setup = evaluation({
      candleIndex: 30,
      status: 'READY',
      action: 'BUY',
      explanation: 'zone retested',
    })
    const outcome = evaluation({
      candleIndex: 30,
      status: 'COMPLETED',
      action: 'NO_TRADE',
      explanation: 'zone retested Outcome: First target reached.',
    })
    const marker = buildPlaybookReplayMarkers({
      setupEvaluations: [setup],
      outcomeEvaluations: [outcome],
    })[0]!
    const replayView = selectedPlaybookSetupView(marker, 'replay')
    expect(replayView?.setupStatus).toBe('READY')
    expect(replayView?.action).toBe('BUY')
    expect(replayView?.explanation).toBe('zone retested')
    expect(replayView?.lifecycleOutcome).toBeNull()
    expect(replayView?.lifecycleOutcomeHidden).toBe(true)
    const fullView = selectedPlaybookSetupView(marker, 'full')
    expect(fullView?.setupStatus).toBe('READY')
    expect(fullView?.lifecycleOutcome?.status).toBe('COMPLETED')
    expect(fullView?.lifecycleOutcomeHidden).toBe(false)
  })
})

describe('playbook replay href', () => {
  it('opens the existing replay route for a backtest without duplicating candles', () => {
    expect(
      playbookReplaySearch({
        kind: 'backtest',
        id: 'bt-eth',
        playbookId: 'bullish-qml-reversal',
        setupCandleIndex: 54,
      }),
    ).toBe('/backtest-replay?backtest=bt-eth&playbook=bullish-qml-reversal&setup=54')
  })

  it('includes dataset timeframe when the source is a library series', () => {
    expect(
      playbookReplaySearch({
        kind: 'dataset',
        id: 'ds-1',
        timeframe: '1h',
        playbookId: 'bearish-continuation',
      }),
    ).toBe('/backtest-replay?dataset=ds-1&timeframe=1h&playbook=bearish-continuation')
  })

  it('round-trips search params and accepts dataset+playbook without a backtest id', () => {
    const href = playbookReplaySearch({
      kind: 'backtest',
      id: 'bt-eth',
      playbookId: 'bullish-qml-reversal',
      setupCandleIndex: 54,
    })
    expect(parsePlaybookReplaySearch(href)).toEqual({
      backtestId: 'bt-eth',
      datasetId: null,
      timeframe: null,
      playbookId: 'bullish-qml-reversal',
      setupCandleIndex: 54,
    })
    const datasetQuery = parsePlaybookReplaySearch(
      '/backtest-replay?dataset=ds-1&timeframe=1h&playbook=bearish-continuation',
    )
    expect(replayPageQueryIsValid(datasetQuery)).toBe(true)
    expect(replayPageQueryIsValid(parsePlaybookReplaySearch(''))).toBe(false)
    expect(replayPageQueryIsValid(parsePlaybookReplaySearch('?dataset=ds-1'))).toBe(false)
  })
})

describe('real history pairing', () => {
  it('uses lifecycle:false snapshots so later price cannot change an earlier marker', () => {
    const crash = [
      ...bullishQmlCandles(),
      ...bearishQmlCandles().slice(0, 8).map((c, i) => ({
        ...c,
        timestamp: new Date(Date.parse(bullishQmlCandles().at(-1)!.timestamp) + (i + 1) * 3_600_000).toISOString(),
      })),
    ]
    const setup = evaluatePlaybookHistory({
      candles: crash,
      events: [],
      definition: BULLISH_QML_REVERSAL,
      parameters: defaultParameters(BULLISH_QML_REVERSAL),
      symbol: 'ETHUSDT',
      timeframe: '1h',
      lifecycle: false,
    })
    const early = setup.evaluations[0]!
    const markers = buildPlaybookReplayMarkers({ setupEvaluations: [early] })
    expect(markers[0]!.setupStatus).toBe(early.status)
    expect(markers[0]!.candleIndex).toBe(early.candleIndex)
  })
})
