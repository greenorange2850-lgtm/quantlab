// ─── Playbook Engine — Deterministic Backtest / Replay API ────────────────────
//
// Prepared for Random Search: evaluation is deterministic, replayable and
// look-ahead free. Each snapshot only sees candles/events up to its index.
// A post-pass applies trade lifecycle outcomes (COMPLETED / INVALIDATED /
// EXPIRED) using subsequent price action — never for setup detection.

import { evaluatePlaybookAt, paramNumber } from './evaluator.js'
import { scoreSetupStrength } from './scoring.js'
import type {
  PlaybookCandle,
  PlaybookDefinition,
  PlaybookEvaluation,
  PlaybookEvent,
  PlaybookHistoryResult,
  PlaybookParameters,
  PlaybookStatus,
} from './types.js'

export interface PlaybookHistoryOptions {
  candles: PlaybookCandle[]
  events: PlaybookEvent[]
  definition: PlaybookDefinition
  parameters: PlaybookParameters
  symbol?: string
  timeframe?: string
  /** Apply post-READY lifecycle outcomes. Defaults to true (backtest mode). */
  lifecycle?: boolean
  /** Override warmup start index. Defaults to swingLookback*2 + 2. */
  startIndex?: number
}

export function warmupIndex(
  _definition: PlaybookDefinition,
  parameters: PlaybookParameters,
): number {
  const lookback = typeof parameters.swingLookback === 'number' ? parameters.swingLookback : 5
  return lookback * 2 + 2
}

/** Single-point, deterministic evaluation — identical to the history snapshot. */
export function replayPlaybook(
  options: PlaybookHistoryOptions,
  index: number,
): PlaybookEvaluation {
  const { candles, events, definition, parameters } = options
  const safeIndex = Math.max(0, Math.min(candles.length - 1, index))
  return evaluatePlaybookAt({
    symbol: options.symbol ?? '',
    timeframe: options.timeframe ?? '',
    candles,
    index: safeIndex,
    events: events.filter((e) => (e.candleIndex ?? candleIndexFor(events, e)) <= safeIndex),
    definition,
    parameters,
  })
}

/** Full-history evaluation. Snapshot per bar; optional lifecycle post-pass. */
export function evaluatePlaybookHistory(
  options: PlaybookHistoryOptions,
): PlaybookHistoryResult {
  const started = performance.now()
  const { candles, events, definition, parameters } = options
  const symbol = options.symbol ?? ''
  const timeframe = options.timeframe ?? ''
  const lifecycle = options.lifecycle ?? true
  const start = options.startIndex ?? warmupIndex(definition, parameters)

  const snapshots: PlaybookEvaluation[] = []
  for (let i = start; i < candles.length; i++) {
    snapshots.push(
      evaluatePlaybookAt({
        symbol,
        timeframe,
        candles,
        index: i,
        events: events.filter((e) => (e.candleIndex ?? candleIndexFor(events, e)) <= i),
        definition,
        parameters,
      }),
    )
  }

  const evaluations = lifecycle
    ? applyLifecycleOutcomes(snapshots, candles, parameters)
    : snapshots

  return summarizeHistory(evaluations, symbol, timeframe, performance.now() - started)
}

/** Post-pass: resolve trade lifecycle for every READY setup. */
export function applyLifecycleOutcomes(
  evaluations: PlaybookEvaluation[],
  candles: PlaybookCandle[],
  parameters: PlaybookParameters,
): PlaybookEvaluation[] {
  const out = evaluations.map((e) => ({
    ...e,
    checks: e.checks.map((c) => ({ ...c })),
    requiredChecks: e.requiredChecks.map((c) => ({ ...c })),
    optionalChecks: e.optionalChecks.map((c) => ({ ...c })),
  }))
  let conclusionPointer = -1

  for (let i = 0; i < out.length; i++) {
    const evaluation = out[i]
    if (evaluation.status !== 'READY') continue
    if (i <= conclusionPointer) continue
    const outcome = findOutcome(evaluation, candles, i, parameters)
    if (!outcome) continue
    // The READY snapshot at `i` is the entry signal; it concludes on the
    // candle found by the outcome scan. Every snapshot up to the conclusion
    // candle belongs to the same trade and cannot start a new one.
    conclusionPointer = outcome.conclusionArrayIndex
    const concluded = out[i]
    concluded.status = outcome.status
    concluded.action = 'NO_TRADE'
    concluded.nextExpectedEvent = null
    concluded.explanation = `${concluded.explanation} Outcome: ${outcome.reason}.`
    concluded.serialized = JSON.stringify({
      ...JSON.parse(concluded.serialized),
      status: outcome.status,
      action: 'NO_TRADE',
    })
  }

  return out
}

interface Outcome {
  conclusionArrayIndex: number
  status: PlaybookStatus
  reason: string
}

function findOutcome(
  evaluation: PlaybookEvaluation,
  candles: PlaybookCandle[],
  arrayIndex: number,
  parameters: PlaybookParameters,
): Outcome | null {
  const stop = evaluation.stopReference?.price
  const target = evaluation.targets[0]?.price
  const maxAge = paramNumber(parameters, 'maxZoneAge', 20)
  const readyCandle = evaluation.candleIndex
  const end = Math.min(candles.length - 1, readyCandle + maxAge + 5)

  for (let j = readyCandle + 1; j <= end; j++) {
    const c = candles[j]
    const conclusionArrayIndex = arrayIndex + (j - readyCandle)
    if (evaluation.direction === 'long') {
      if (stop !== undefined && c.low <= stop) {
        return { conclusionArrayIndex, status: 'INVALIDATED', reason: `Stop hit at ${stop.toFixed(5)}` }
      }
      if (target !== undefined && c.high >= target) {
        return { conclusionArrayIndex, status: 'COMPLETED', reason: `First target ${target.toFixed(5)} reached` }
      }
    } else {
      if (stop !== undefined && c.high >= stop) {
        return { conclusionArrayIndex, status: 'INVALIDATED', reason: `Stop hit at ${stop.toFixed(5)}` }
      }
      if (target !== undefined && c.low <= target) {
        return { conclusionArrayIndex, status: 'COMPLETED', reason: `First target ${target.toFixed(5)} reached` }
      }
    }
    if (j - readyCandle >= maxAge) {
      return { conclusionArrayIndex, status: 'EXPIRED', reason: `Setup expired after ${maxAge} bars` }
    }
  }
  return null
}

function summarizeHistory(
  evaluations: PlaybookEvaluation[],
  symbol: string,
  timeframe: string,
  durationMs: number,
): PlaybookHistoryResult {
  let readies = 0
  let watch = 0
  let wait = 0
  let invalidated = 0
  let completed = 0
  let expired = 0
  let strengthSum = 0
  let max = 0

  for (const e of evaluations) {
    switch (e.status) {
      case 'READY': readies++; break
      case 'WATCHING': watch++; break
      case 'WAITING_RETEST': wait++; break
      case 'INVALIDATED': invalidated++; break
      case 'COMPLETED': completed++; break
      case 'EXPIRED': expired++; break
    }
    strengthSum += e.strength
    if (e.strength > max) max = e.strength
  }

  return {
    playbookId: evaluations[0]?.playbookId ?? '',
    playbookVersion: evaluations[0]?.playbookVersion ?? '',
    symbol,
    timeframe,
    startTimestamp: evaluations[0]?.timestamp ?? '',
    endTimestamp: evaluations[evaluations.length - 1]?.timestamp ?? '',
    evaluations,
    readies,
    watchCount: watch,
    waitRetestCount: wait,
    invalidatedCount: invalidated,
    completedCount: completed,
    expiredCount: expired,
    averageStrength: evaluations.length > 0 ? Math.round((strengthSum / evaluations.length) * 10) / 10 : 0,
    maxStrength: max,
    durationMs: Math.round(durationMs * 10) / 10,
  }
}

/**
 * Deterministic single-value score of a history — the objective Random Search
 * can maximize. Strength-only (setup quality), never a win-probability claim.
 */
export function scoreHistory(result: PlaybookHistoryResult): number {
  if (result.evaluations.length === 0) return 0
  const readyScore = result.readies * 10
  const strengthScore = result.averageStrength
  const completedBoost = result.completedCount * 5
  return Math.round((readyScore + strengthScore + completedBoost) * 10) / 10
}

function candleIndexFor(events: PlaybookEvent[], target: PlaybookEvent): number {
  const idx = events.indexOf(target)
  return idx >= 0 ? idx : Number.MAX_SAFE_INTEGER
}

export { scoreSetupStrength }
