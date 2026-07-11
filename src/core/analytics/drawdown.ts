import type { EnrichedEquityPoint, DrawdownAnalysis } from './types.js'
import { computeMaxDrawdownFromCurve } from './equity-curve.js'

export function analyzeDrawdown(curve: EnrichedEquityPoint[]): DrawdownAnalysis {
  if (curve.length === 0) {
    return {
      currentDrawdown: 0,
      maxDrawdown: 0,
      maxDrawdownDurationMs: 0,
      maxDrawdownRecoveryMs: null,
    }
  }

  let peak = curve[0].equity
  let peakTime = curve[0].time
  let inDrawdown = false
  let drawdownPeakTime = peakTime
  let troughTime = peakTime
  let troughEquity = peak
  let maxDrawdownDurationMs = 0
  let maxDrawdownRecoveryMs: number | null = null

  const registerEpisode = (endTime: number, recovered: boolean): void => {
    const duration = endTime - drawdownPeakTime
    if (duration > maxDrawdownDurationMs) {
      maxDrawdownDurationMs = duration
      maxDrawdownRecoveryMs = recovered ? endTime - troughTime : null
    }
  }

  for (const point of curve) {
    if (point.equity >= peak) {
      if (inDrawdown) {
        registerEpisode(point.time, true)
        inDrawdown = false
      }

      peak = point.equity
      peakTime = point.time
      continue
    }

    if (!inDrawdown) {
      inDrawdown = true
      drawdownPeakTime = peakTime
      troughTime = point.time
      troughEquity = point.equity
      continue
    }

    if (point.equity < troughEquity) {
      troughEquity = point.equity
      troughTime = point.time
    }
  }

  if (inDrawdown) {
    registerEpisode(curve.at(-1)!.time, false)
  }

  return {
    currentDrawdown: curve.at(-1)?.drawdown ?? 0,
    maxDrawdown: computeMaxDrawdownFromCurve(curve),
    maxDrawdownDurationMs,
    maxDrawdownRecoveryMs,
  }
}
