// ─── Playbook Engine — Demo Data ───────────────────────────────────────────────
//
// Production-quality playbook results for the Lab UI, computed from the same
// deterministic fixtures the test suite uses. Consumes detector outputs
// read-only and returns derived pipeline results.

import { collectDiagnostics } from './diagnostics.js'
import { defaultParameters } from './parameters.js'
import { runPlaybookPipeline, type PlaybookPipelineResult } from './pipeline.js'
import { playbookRegistry } from './registry.js'
import type {
  PlaybookCandle,
  PlaybookDefinition,
  PlaybookDiagnostics,
  PlaybookEvent,
  PlaybookParameters,
} from './types.js'
import {
  bearishContinuationCandles,
  bearishContinuationEvents,
  bearishQmlCandles,
  bullishContinuationCandles,
  bullishContinuationEvents,
  bullishQmlCandles,
} from './__tests__/fixtures.js'

interface DemoSource {
  candles: PlaybookCandle[]
  events: PlaybookEvent[]
}

const DEMO_SOURCES: Record<string, () => DemoSource> = {
  'bullish-qml-reversal': () => ({ candles: bullishQmlCandles(), events: [] }),
  'bearish-qml-reversal': () => ({ candles: bearishQmlCandles(), events: [] }),
  'bullish-continuation': () => ({
    candles: bullishContinuationCandles(),
    events: bullishContinuationEvents(),
  }),
  'bearish-continuation': () => ({
    candles: bearishContinuationCandles(),
    events: bearishContinuationEvents(),
  }),
}

/** Resolve a playbook definition, throwing on unknown ids. */
export function demoDefinition(playbookId: string): PlaybookDefinition {
  const definition = playbookRegistry.get(playbookId)
  if (!definition) throw new Error(`Unknown playbook "${playbookId}"`)
  return definition
}

/** Run the full pipeline over the demo source for a playbook. */
export function demoPipelineResult(
  playbookId: string,
  parameters?: PlaybookParameters,
): PlaybookPipelineResult {
  const definition = demoDefinition(playbookId)
  const source = DEMO_SOURCES[playbookId]
  if (!source) throw new Error(`No demo source for "${playbookId}"`)
  const { candles, events } = source()
  return runPlaybookPipeline({
    symbol: 'BTCUSDT',
    timeframe: '1h',
    candles,
    events,
    playbookId,
    parameters: parameters ?? defaultParameters(definition),
  })
}

/** Aggregate diagnostics across the demo history for a playbook. */
export function demoDiagnostics(playbookId: string): PlaybookDiagnostics {
  const result = demoPipelineResult(playbookId)
  return collectDiagnostics(result.history.evaluations)
}
