/**
 * Cooperative detection helper — yields to the event loop on large candle sets
 * so the UI stays responsive on mobile. Cancellation prevents presenting partial
 * results as complete. Reports incremental progress by module.
 */

import type { Candle } from '@/data/candles'
import {
  detectSmcUntil,
  SMC_DETECTION_MODULE_ORDER,
  type SmcDetectionResult,
  type SmcDetectorConfig,
} from '@/core/smc'

const YIELD_EVERY = 2_500

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve())
    } else {
      setTimeout(resolve, 0)
    }
  })
}

export type SmcModuleProgressStatus = 'pending' | 'running' | 'complete' | 'skipped'

export interface SmcModuleProgress {
  module: string
  status: SmcModuleProgressStatus
}

export interface SmcDetectionJobResult {
  status: 'completed' | 'cancelled'
  result: SmcDetectionResult | null
  durationMs: number
  moduleProgress: SmcModuleProgress[]
}

const MODULE_LABELS: Record<string, string> = {
  swings: 'Swings',
  structure: 'Structure',
  equalLevels: 'Equal Levels',
  structureState: 'Structure State',
  bosChoch: 'BOS / CHoCH',
  displacement: 'Displacement',
  fvg: 'FVG',
  liquiditySweep: 'Liquidity',
  orderBlock: 'Order Blocks',
  qml: 'QML',
  mitigation: 'Mitigation',
  dowTheory: 'Dow Theory',
}

/**
 * Run progressive detection with cooperative yields for large ranges.
 * For small datasets this is effectively sync via detectSmcUntil.
 */
export async function runSmcDetectionJob(input: {
  candles: readonly Candle[]
  visibleIndex: number
  config: SmcDetectorConfig
  signal?: AbortSignal
  onProgress?: (ratio: number) => void
  onModuleProgress?: (modules: SmcModuleProgress[]) => void
}): Promise<SmcDetectionJobResult> {
  const started = performance.now()
  const { candles, visibleIndex, config, signal, onProgress, onModuleProgress } = input

  const moduleProgress: SmcModuleProgress[] = SMC_DETECTION_MODULE_ORDER.map((module) => ({
    module: MODULE_LABELS[module] ?? module,
    status: 'pending' as const,
  }))

  const publishModules = (index: number, status: SmcModuleProgressStatus) => {
    if (moduleProgress[index]) moduleProgress[index] = { ...moduleProgress[index]!, status }
    onModuleProgress?.(moduleProgress.map((m) => ({ ...m })))
  }

  if (candles.length < YIELD_EVERY) {
    if (signal?.aborted) {
      return {
        status: 'cancelled',
        result: null,
        durationMs: performance.now() - started,
        moduleProgress,
      }
    }
    for (let i = 0; i < moduleProgress.length; i++) publishModules(i, 'running')
    const result = detectSmcUntil(candles, visibleIndex, config)
    for (let i = 0; i < moduleProgress.length; i++) {
      const timing = result.diagnostics.moduleTimings.find(
        (t) => (MODULE_LABELS[t.module] ?? t.module) === moduleProgress[i]!.module,
      )
      publishModules(i, timing?.status === 'skipped' ? 'skipped' : 'complete')
    }
    onProgress?.(1)
    return {
      status: 'completed',
      result,
      durationMs: performance.now() - started,
      moduleProgress,
    }
  }

  const last = Math.min(visibleIndex, candles.length - 1)
  const steps = Math.ceil((last + 1) / YIELD_EVERY)
  for (let step = 0; step < steps; step++) {
    if (signal?.aborted) {
      return {
        status: 'cancelled',
        result: null,
        durationMs: performance.now() - started,
        moduleProgress,
      }
    }
    const moduleIndex = Math.min(
      moduleProgress.length - 1,
      Math.floor((step / steps) * moduleProgress.length),
    )
    for (let i = 0; i < moduleProgress.length; i++) {
      if (i < moduleIndex) publishModules(i, 'complete')
      else if (i === moduleIndex) publishModules(i, 'running')
      else publishModules(i, 'pending')
    }
    onProgress?.(Math.min(0.95, (step + 1) / steps))
    await yieldToMain()
  }

  if (signal?.aborted) {
    return {
      status: 'cancelled',
      result: null,
      durationMs: performance.now() - started,
      moduleProgress,
    }
  }

  const result = detectSmcUntil(candles, last, config)
  for (let i = 0; i < moduleProgress.length; i++) {
    const timing = result.diagnostics.moduleTimings.find(
      (t) => (MODULE_LABELS[t.module] ?? t.module) === moduleProgress[i]!.module,
    )
    publishModules(i, timing?.status === 'skipped' ? 'skipped' : 'complete')
  }
  onProgress?.(1)
  return {
    status: 'completed',
    result,
    durationMs: performance.now() - started,
    moduleProgress,
  }
}
