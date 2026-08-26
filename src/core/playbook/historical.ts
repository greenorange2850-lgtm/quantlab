// ─── Playbook Engine — Historical Evaluation Path ─────────────────────────────
//
// Evaluates a playbook over real QuantLab historical/replay candles using the
// existing deterministic pipeline. Does not rewrite the evaluator, definitions,
// or detector algorithms. Demo fixtures are not used here.

import { warmupIndex } from './backtest.js'
import { collectDiagnostics } from './diagnostics.js'
import {
  adaptHistoricalCandles,
  adaptHistoricalDetectorEvents,
  inspectPlaybookEventSupport,
  type DetectorEventInspection,
  type QuantLabOhlcvCandle,
} from './historical-adapter.js'
import { defaultParameters } from './parameters.js'
import { runPlaybookPipeline, type PlaybookPipelineResult } from './pipeline.js'
import { playbookRegistry } from './registry.js'
import type {
  PlaybookCandle,
  PlaybookDiagnostics,
  PlaybookEvent,
  PlaybookKind,
  PlaybookParameters,
} from './types.js'

export type PlaybookLabDataSourceKind = 'demo' | 'historical'

export type HistoricalLoadErrorCode =
  | 'missing_symbol'
  | 'unknown_timeframe'
  | 'missing_candles'
  | 'insufficient_warmup'
  | 'unknown_playbook'
  | 'invalid_candles'

export class HistoricalEvaluationError extends Error {
  readonly code: HistoricalLoadErrorCode

  constructor(code: HistoricalLoadErrorCode, message: string) {
    super(message)
    this.name = 'HistoricalEvaluationError'
    this.code = code
  }
}

/** Cursor fields preserved so a later phase can map onto Backtest Replay. */
export interface PlaybookReplayCursor {
  candleIndex: number
  timestamp: string
  symbol: string
  timeframe: string
}

export interface PlaybookHistoricalSeries {
  symbol: string
  timeframe: string
  candles: PlaybookCandle[]
  events: PlaybookEvent[]
  /** Source array index of each adapted candle — identical to replay candleIndex. */
  candleIndexes: number[]
}

export interface HistoricalEvaluationInput {
  playbookId: string
  parameters?: PlaybookParameters
  symbol: string
  timeframe: string
  /** QuantLab/replay candles (time in ms). */
  candles: readonly QuantLabOhlcvCandle[]
  /** Detector outputs only. Execution traces are ignored, never converted. */
  detectorEvents?: unknown
}

export interface HistoricalEvaluationMeta {
  symbol: string
  timeframe: string
  candleCount: number
  evaluatedRange: { start: string; end: string } | null
  warmupBars: number
  replayCursor: PlaybookReplayCursor | null
}

export interface HistoricalEvaluationSuccess {
  ok: true
  result: PlaybookPipelineResult
  diagnostics: PlaybookDiagnostics
  eventSupport: DetectorEventInspection
  meta: HistoricalEvaluationMeta
}

export interface HistoricalEvaluationFailure {
  ok: false
  error: HistoricalEvaluationError
}

export type HistoricalEvaluationOutcome =
  | HistoricalEvaluationSuccess
  | HistoricalEvaluationFailure

export function resolveHistoricalSymbol(raw: string | null | undefined): string {
  const symbol = typeof raw === 'string' ? raw.trim() : ''
  if (!symbol) {
    throw new HistoricalEvaluationError(
      'missing_symbol',
      'This dataset has no symbol. Missing metadata is not invented.',
    )
  }
  return symbol
}

export function resolveHistoricalTimeframe(raw: string | null | undefined): string {
  const timeframe = typeof raw === 'string' ? raw.trim() : ''
  if (!timeframe) {
    throw new HistoricalEvaluationError(
      'unknown_timeframe',
      'This dataset has no timeframe. Missing metadata is not invented.',
    )
  }
  return timeframe
}

export function buildHistoricalSeries(input: {
  symbol: string
  timeframe: string
  candles: readonly QuantLabOhlcvCandle[]
  detectorEvents?: unknown
}): PlaybookHistoricalSeries {
  const symbol = resolveHistoricalSymbol(input.symbol)
  const timeframe = resolveHistoricalTimeframe(input.timeframe)
  if (input.candles.length === 0) {
    throw new HistoricalEvaluationError(
      'missing_candles',
      'This dataset has no candles to evaluate.',
    )
  }

  let candles: PlaybookCandle[]
  try {
    candles = adaptHistoricalCandles(input.candles)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid historical candles'
    throw new HistoricalEvaluationError('invalid_candles', message)
  }

  const adaptedEvents = adaptHistoricalDetectorEvents(input.detectorEvents)
  return {
    symbol,
    timeframe,
    candles,
    events: adaptedEvents.events,
    candleIndexes: candles.map((_, i) => i),
  }
}

export function playbookKindForId(playbookId: string): PlaybookKind | null {
  const definition = playbookRegistry.get(playbookId)
  return definition?.kind ?? null
}

/**
 * Evaluate a playbook over a real historical series through the existing
 * `runPlaybookPipeline` → `evaluatePlaybookHistory` path.
 */
export function evaluateHistoricalPlaybook(
  input: HistoricalEvaluationInput,
): HistoricalEvaluationOutcome {
  const definition = playbookRegistry.get(input.playbookId)
  if (!definition) {
    return {
      ok: false,
      error: new HistoricalEvaluationError(
        'unknown_playbook',
        `Unknown playbook "${input.playbookId}"`,
      ),
    }
  }

  let series: PlaybookHistoricalSeries
  try {
    series = buildHistoricalSeries({
      symbol: input.symbol,
      timeframe: input.timeframe,
      candles: input.candles,
      detectorEvents: input.detectorEvents,
    })
  } catch (err) {
    if (err instanceof HistoricalEvaluationError) {
      return { ok: false, error: err }
    }
    const message = err instanceof Error ? err.message : 'Historical evaluation failed'
    return { ok: false, error: new HistoricalEvaluationError('invalid_candles', message) }
  }

  const parameters = input.parameters ?? defaultParameters(definition)
  const warmupBars = warmupIndex(definition, parameters)
  if (series.candles.length <= warmupBars) {
    return {
      ok: false,
      error: new HistoricalEvaluationError(
        'insufficient_warmup',
        `Need more than ${warmupBars} candles for warmup (swing lookback); this series has ${series.candles.length}.`,
      ),
    }
  }

  const result = runPlaybookPipeline({
    symbol: series.symbol,
    timeframe: series.timeframe,
    candles: series.candles,
    events: series.events,
    playbookId: input.playbookId,
    parameters,
  })

  const last = result.history.evaluations[result.history.evaluations.length - 1]
  const replayCursor: PlaybookReplayCursor | null = last
    ? {
        candleIndex: last.candleIndex,
        timestamp: last.timestamp,
        symbol: last.symbol,
        timeframe: last.timeframe,
      }
    : null

  const evaluatedRange =
    result.history.evaluations.length > 0
      ? { start: result.history.startTimestamp, end: result.history.endTimestamp }
      : null

  return {
    ok: true,
    result,
    diagnostics: collectDiagnostics(result.history.evaluations),
    eventSupport: inspectPlaybookEventSupport(definition.kind, series.events),
    meta: {
      symbol: series.symbol,
      timeframe: series.timeframe,
      candleCount: series.candles.length,
      evaluatedRange,
      warmupBars,
      replayCursor,
    },
  }
}
