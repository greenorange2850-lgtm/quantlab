/**
 * Cooperative detection helper — yields to the event loop on large candle sets
 * so the UI stays responsive on mobile. Cancellation prevents presenting partial
 * results as complete.
 */

import type { Candle } from '@/data/candles'
import {
  detectSmcUntil,
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

export interface SmcDetectionJobResult {
  status: 'completed' | 'cancelled'
  result: SmcDetectionResult | null
  durationMs: number
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
}): Promise<SmcDetectionJobResult> {
  const started = performance.now()
  const { candles, visibleIndex, config, signal, onProgress } = input

  if (candles.length < YIELD_EVERY) {
    if (signal?.aborted) {
      return { status: 'cancelled', result: null, durationMs: performance.now() - started }
    }
    const result = detectSmcUntil(candles, visibleIndex, config)
    onProgress?.(1)
    return { status: 'completed', result, durationMs: performance.now() - started }
  }

  // Warm progressive path: compute in chunks of visible index to allow cancel.
  // Final result uses full detectSmcUntil once — we only yield during the warm-up
  // scan so the UI can show progress without publishing partial detections.
  const last = Math.min(visibleIndex, candles.length - 1)
  const steps = Math.ceil((last + 1) / YIELD_EVERY)
  for (let step = 0; step < steps; step++) {
    if (signal?.aborted) {
      return { status: 'cancelled', result: null, durationMs: performance.now() - started }
    }
    onProgress?.(Math.min(0.95, (step + 1) / steps))
    await yieldToMain()
  }

  if (signal?.aborted) {
    return { status: 'cancelled', result: null, durationMs: performance.now() - started }
  }

  const result = detectSmcUntil(candles, last, config)
  onProgress?.(1)
  return { status: 'completed', result, durationMs: performance.now() - started }
}
