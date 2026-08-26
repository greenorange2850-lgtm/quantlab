// ─── Playbook Lab — Replay overlay mapping ────────────────────────────────────
//
// Maps Playbook history onto Backtest Replay. Lives outside the evaluator:
// it never changes decision rules. Setup state is taken from lifecycle:false
// snapshots; COMPLETED / INVALIDATED / EXPIRED are attached as outcome metadata.

import {
  buildHistoricalSeries,
  defaultParameters,
  evaluatePlaybookHistory,
  isTerminalStatus,
  playbookRegistry,
  type PlaybookAction,
  type PlaybookCheck,
  type PlaybookDirection,
  type PlaybookEvaluation,
  type PlaybookHistoryResult,
  type PlaybookParameters,
  type PlaybookStatus,
  type QuantLabOhlcvCandle,
  type StopReference,
  type Target,
} from '@/core/playbook'

export type PlaybookLifecycleOutcomeStatus = Extract<
  PlaybookStatus,
  'COMPLETED' | 'INVALIDATED' | 'EXPIRED'
>

export interface PlaybookLifecycleOutcome {
  status: PlaybookLifecycleOutcomeStatus
  reason: string
}

export interface PlaybookReplayMarker {
  id: string
  playbookId: string
  playbookVersion: string
  playbookName: string
  candleIndex: number
  timestamp: string
  timeMs: number
  symbol: string
  timeframe: string
  /** Status that was available at this candle — never a future lifecycle rewrite. */
  setupStatus: PlaybookStatus
  action: PlaybookAction
  direction: PlaybookDirection
  strength: number
  stopReference: StopReference | null
  targets: Target[]
  explanation: string
  requiredChecks: PlaybookCheck[]
  optionalChecks: PlaybookCheck[]
  /** Present only when a later-price post-pass concluded the READY setup. */
  lifecycleOutcome: PlaybookLifecycleOutcome | null
  anchorPrice: number | null
}

export interface PlaybookReplayOverlay {
  markers: PlaybookReplayMarker[]
  setupHistory: PlaybookHistoryResult
  outcomeHistory: PlaybookHistoryResult
}

const OUTCOME_SUFFIX = /\s*Outcome:\s*(.+?)\.?\s*$/

export function extractLifecycleOutcome(
  setup: PlaybookEvaluation,
  outcome: PlaybookEvaluation,
): PlaybookLifecycleOutcome | null {
  if (setup.status !== 'READY') return null
  if (!isTerminalStatus(outcome.status)) return null
  const match = outcome.explanation.match(OUTCOME_SUFFIX)
  return {
    status: outcome.status as PlaybookLifecycleOutcomeStatus,
    reason: match?.[1]?.trim() || outcome.explanation,
  }
}

export function evaluationsByCandleIndex(
  evaluations: readonly PlaybookEvaluation[],
): Map<number, PlaybookEvaluation> {
  const map = new Map<number, PlaybookEvaluation>()
  for (const evaluation of evaluations) {
    map.set(evaluation.candleIndex, evaluation)
  }
  return map
}

/** Keep the first bar of each status streak — not every candle. */
export function selectPlaybookStateTransitions(
  evaluations: readonly PlaybookEvaluation[],
): PlaybookEvaluation[] {
  const selected: PlaybookEvaluation[] = []
  let previous: PlaybookStatus | null = null
  for (const evaluation of evaluations) {
    if (evaluation.status === previous) continue
    selected.push(evaluation)
    previous = evaluation.status
  }
  return selected
}

function anchorPriceFor(evaluation: PlaybookEvaluation): number | null {
  if (evaluation.entryZone) {
    return (evaluation.entryZone.zone.top + evaluation.entryZone.zone.bottom) / 2
  }
  if (evaluation.stopReference) return evaluation.stopReference.price
  if (evaluation.targets[0]) return evaluation.targets[0].price
  return null
}

export function buildPlaybookReplayMarkers(input: {
  setupEvaluations: readonly PlaybookEvaluation[]
  outcomeEvaluations?: readonly PlaybookEvaluation[]
  playbookName?: string
  candleTimeByIndex?: ReadonlyMap<number, number>
}): PlaybookReplayMarker[] {
  const outcomes = evaluationsByCandleIndex(input.outcomeEvaluations ?? [])
  const transitions = selectPlaybookStateTransitions(input.setupEvaluations)
  const name = input.playbookName ?? ''

  return transitions.map((setup, order) => {
    const outcomeEval = outcomes.get(setup.candleIndex)
    const lifecycleOutcome = outcomeEval ? extractLifecycleOutcome(setup, outcomeEval) : null
    const parsed = Date.parse(setup.timestamp)
    const timeMs = input.candleTimeByIndex?.get(setup.candleIndex)
      ?? (Number.isFinite(parsed) ? parsed : 0)

    return {
      id: `${setup.playbookId}:${setup.candleIndex}:${setup.status}:${order}`,
      playbookId: setup.playbookId,
      playbookVersion: setup.playbookVersion,
      playbookName: name,
      candleIndex: setup.candleIndex,
      timestamp: setup.timestamp,
      timeMs,
      symbol: setup.symbol,
      timeframe: setup.timeframe,
      setupStatus: setup.status,
      action: setup.action,
      direction: setup.direction,
      strength: setup.strength,
      stopReference: setup.stopReference,
      targets: setup.targets,
      explanation: setup.explanation,
      requiredChecks: setup.requiredChecks,
      optionalChecks: setup.optionalChecks,
      lifecycleOutcome,
      anchorPrice: anchorPriceFor(setup),
    }
  })
}

export function buildPlaybookReplayOverlay(input: {
  playbookId: string
  playbookName?: string
  parameters?: PlaybookParameters
  symbol: string
  timeframe: string
  candles: readonly QuantLabOhlcvCandle[]
  detectorEvents?: unknown
}): PlaybookReplayOverlay {
  const definition = playbookRegistry.get(input.playbookId)
  if (!definition) {
    throw new Error(`Unknown playbook "${input.playbookId}"`)
  }
  const series = buildHistoricalSeries({
    symbol: input.symbol,
    timeframe: input.timeframe,
    candles: input.candles,
    detectorEvents: input.detectorEvents,
  })
  const parameters = input.parameters ?? defaultParameters(definition)
  const shared = {
    candles: series.candles,
    events: series.events,
    definition,
    parameters,
    symbol: series.symbol,
    timeframe: series.timeframe,
  }
  const setupHistory = evaluatePlaybookHistory({ ...shared, lifecycle: false })
  const outcomeHistory = evaluatePlaybookHistory({ ...shared, lifecycle: true })
  const candleTimeByIndex = new Map(
    input.candles.map((candle, index) => [index, candle.time]),
  )

  return {
    setupHistory,
    outcomeHistory,
    markers: buildPlaybookReplayMarkers({
      setupEvaluations: setupHistory.evaluations,
      outcomeEvaluations: outcomeHistory.evaluations,
      playbookName: input.playbookName ?? definition.name,
      candleTimeByIndex,
    }),
  }
}

export function playbookMarkersVisibleAtCursor(
  markers: readonly PlaybookReplayMarker[],
  cursorIndex: number | null,
  mode: 'full' | 'replay',
): PlaybookReplayMarker[] {
  if (mode === 'full' || cursorIndex === null) return [...markers]
  return markers.filter((marker) => marker.candleIndex <= cursorIndex)
}

/** Outcomes use later price and must not replace the setup state during replay. */
export function isLifecycleOutcomeVisible(mode: 'full' | 'replay'): boolean {
  return mode === 'full'
}

export function clampSetupIndex(index: number, count: number): number {
  if (count <= 0) return 0
  return Math.max(0, Math.min(count - 1, index))
}

export function adjacentSetupIndex(
  selectedIndex: number,
  count: number,
  delta: number,
): number {
  return clampSetupIndex(selectedIndex + delta, count)
}

export function findSetupIndexByCandle(
  markers: readonly PlaybookReplayMarker[],
  candleIndex: number,
): number {
  if (markers.length === 0) return -1
  let best = 0
  for (let i = 0; i < markers.length; i++) {
    if (markers[i]!.candleIndex === candleIndex) return i
    if (markers[i]!.candleIndex <= candleIndex) best = i
  }
  return best
}

export interface PlaybookReplayQuery {
  backtestId: string | null
  datasetId: string | null
  timeframe: string | null
  playbookId: string | null
  setupCandleIndex: number | null
}

function trimQueryValue(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function parsePlaybookReplaySearch(input: string | URLSearchParams): PlaybookReplayQuery {
  const params =
    typeof input === 'string'
      ? new URLSearchParams(input.includes('?') ? input.slice(input.indexOf('?') + 1) : input)
      : input
  const setupRaw = trimQueryValue(params.get('setup'))
  const setupNum = setupRaw != null ? Number(setupRaw) : Number.NaN
  return {
    backtestId: trimQueryValue(params.get('backtest') ?? params.get('id')),
    datasetId: trimQueryValue(params.get('dataset')),
    timeframe: trimQueryValue(params.get('timeframe')),
    playbookId: trimQueryValue(params.get('playbook')),
    setupCandleIndex: Number.isFinite(setupNum) ? Math.trunc(setupNum) : null,
  }
}

export function replayPageQueryIsValid(query: PlaybookReplayQuery): boolean {
  return Boolean(query.backtestId) || Boolean(query.datasetId && query.playbookId)
}

export function playbookReplaySearch(input: {
  kind: 'backtest' | 'dataset'
  id: string
  playbookId: string
  timeframe?: string | null
  setupCandleIndex?: number | null
}): string {
  const params = new URLSearchParams()
  if (input.kind === 'backtest') params.set('backtest', input.id)
  else {
    params.set('dataset', input.id)
    if (input.timeframe) params.set('timeframe', input.timeframe)
  }
  params.set('playbook', input.playbookId)
  if (input.setupCandleIndex != null && Number.isFinite(input.setupCandleIndex)) {
    params.set('setup', String(Math.trunc(input.setupCandleIndex)))
  }
  return `/backtest-replay?${params.toString()}`
}

/** Jump the existing replay cursor to the setup candle — no future bars. */
export function replayCursorForSetup(marker: PlaybookReplayMarker): {
  cursorIndex: number
  mode: 'replay'
  playing: false
} {
  return {
    cursorIndex: marker.candleIndex,
    mode: 'replay',
    playing: false,
  }
}

export function playbookChartPresentation(
  markers: readonly PlaybookReplayMarker[],
  cursorIndex: number | null,
  mode: 'full' | 'replay',
): {
  markers: PlaybookReplayMarker[]
  showLifecycleOutcome: boolean
} {
  return {
    markers: playbookMarkersVisibleAtCursor(markers, cursorIndex, mode),
    showLifecycleOutcome: isLifecycleOutcomeVisible(mode),
  }
}

export function selectedPlaybookSetupView(
  marker: PlaybookReplayMarker | null,
  mode: 'full' | 'replay',
) {
  if (!marker) return null
  const outcomeVisible = isLifecycleOutcomeVisible(mode)
  return {
    playbookName: marker.playbookName || marker.playbookId,
    symbol: marker.symbol,
    timeframe: marker.timeframe,
    timestamp: marker.timestamp,
    candleIndex: marker.candleIndex,
    setupStatus: marker.setupStatus,
    action: marker.action,
    direction: marker.direction,
    strength: marker.strength,
    requiredChecks: marker.requiredChecks,
    optionalChecks: marker.optionalChecks,
    stopReference: marker.stopReference,
    firstTarget: marker.targets[0] ?? null,
    explanation: marker.explanation,
    lifecycleOutcome: outcomeVisible ? marker.lifecycleOutcome : null,
    lifecycleOutcomeHidden: Boolean(marker.lifecycleOutcome) && !outcomeVisible,
  }
}

export function playbookMarkerPlotPrice(
  marker: PlaybookReplayMarker,
  closeByTime: ReadonlyMap<number, number>,
): number | null {
  if (marker.anchorPrice != null && Number.isFinite(marker.anchorPrice)) return marker.anchorPrice
  const close = closeByTime.get(marker.timeMs)
  return close != null && Number.isFinite(close) ? close : null
}

export const PLAYBOOK_MARKER_LABELS: Record<PlaybookStatus, string> = {
  WATCHING: 'WATCH',
  WAITING_RETEST: 'WAIT',
  READY: 'RDY',
  INVALIDATED: 'INV',
  COMPLETED: 'DONE',
  EXPIRED: 'EXP',
}

export const PLAYBOOK_MARKER_COLORS: Record<PlaybookStatus, string> = {
  WATCHING: '#a1a1aa',
  WAITING_RETEST: '#f59e0b',
  READY: '#22c55e',
  INVALIDATED: '#ef4444',
  COMPLETED: '#38bdf8',
  EXPIRED: '#71717a',
}
