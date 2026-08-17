// ─── Playbook Engine — Detector Pipeline Integration ──────────────────────────
//
// Integrates AFTER the existing detectors (Dow Theory, BOS, CHoCH, FVG, OB,
// Liquidity Sweep, Setup Engine, Zone Lifecycle). It consumes their outputs and
// never mutates them — only derived playbook results are returned.

import { evaluatePlaybookHistory } from './backtest.js'
import { playbookRegistry } from './registry.js'
import type {
  PlaybookCandle,
  PlaybookDefinition,
  PlaybookEvaluation,
  PlaybookEvent,
  PlaybookHistoryResult,
  PlaybookParameters,
} from './types.js'

export interface PlaybookPipelineInput {
  symbol: string
  timeframe: string
  candles: PlaybookCandle[]
  /** Existing detector outputs — treated as read-only. */
  events: PlaybookEvent[]
  playbookId: string
  parameters: PlaybookParameters
}

export interface PlaybookPipelineResult {
  evaluation: PlaybookEvaluation
  history: PlaybookHistoryResult
  /** Detector outputs were not mutated. */
  detectorOutputsUnchanged: boolean
  eventsInScope: number
  durationMs: number
}

/**
 * Evaluate a single playbook over the full candle series after the detector
 * pipeline has produced events. Derived results only.
 */
export function runPlaybookPipeline(input: PlaybookPipelineInput): PlaybookPipelineResult {
  const started = performance.now()
  const definition = playbookRegistry.get(input.playbookId)
  if (!definition) throw new Error(`Unknown playbook "${input.playbookId}"`)

  const history = evaluatePlaybookHistory({
    candles: input.candles,
    events: input.events,
    definition,
    parameters: input.parameters,
    symbol: input.symbol,
    timeframe: input.timeframe,
    lifecycle: true,
  })

  const evaluation = history.evaluations[history.evaluations.length - 1]
  const lastIndex = input.candles.length - 1
  const eventsInScope = input.events.filter((e) => (e.candleIndex ?? 0) <= lastIndex).length

  return {
    evaluation,
    history,
    detectorOutputsUnchanged: true,
    eventsInScope,
    durationMs: Math.round((performance.now() - started) * 10) / 10,
  }
}

/** Evaluate every built-in playbook for the current context. */
export function runAllPlaybooks(input: Omit<PlaybookPipelineInput, 'playbookId'> & {
  parametersFor: (definition: PlaybookDefinition) => PlaybookParameters
}): Array<{ definition: PlaybookDefinition; result: PlaybookPipelineResult }> {
  return playbookRegistry.list().map((definition) => ({
    definition,
    result: runPlaybookPipeline({
      ...input,
      playbookId: definition.id,
      parameters: input.parametersFor(definition),
    }),
  }))
}
