import type { Candle } from '@/data/candles'
import { detectBreakOfStructure } from './bos-detector'
import { cloneSmcDetectorConfig, DEFAULT_SMC_DETECTOR_CONFIG } from './defaults'
import { detectConfirmedSwings } from './swing-detector'
import type { SmcDetectionResult, SmcDetectorConfig } from './types'
import { SMC_DETECTOR_VERSION } from './types'
import { validateSmcDetectorConfig } from './validation'

function emptyDiagnostics(
  candleCount: number,
  visibleThroughIndex: number | null,
  durationMs: number,
): SmcDetectionResult['diagnostics'] {
  return {
    detectorVersion: SMC_DETECTOR_VERSION,
    candleCount,
    visibleThroughIndex,
    swingCandidatesConsidered: 0,
    confirmedSwings: 0,
    wickOnlyBreakCandidatesIgnored: 0,
    validBosEvents: 0,
    repeatedBreaksIgnored: 0,
    computationDurationMs: durationMs,
  }
}

/**
 * Progressive detection API — only events knowable by `visibleIndex` (inclusive).
 * No look-ahead: unconfirmed swings and future BOS are excluded.
 */
export function detectSmcUntil(
  candles: readonly Candle[],
  visibleIndex: number,
  config: SmcDetectorConfig = DEFAULT_SMC_DETECTOR_CONFIG,
): SmcDetectionResult {
  const started = performance.now()
  const { config: safe } = validateSmcDetectorConfig(config)

  if (candles.length === 0 || visibleIndex < 0) {
    return {
      swings: [],
      bosEvents: [],
      diagnostics: emptyDiagnostics(candles.length, visibleIndex < 0 ? null : visibleIndex, 0),
    }
  }

  const last = Math.min(visibleIndex, candles.length - 1)
  const swingResult = detectConfirmedSwings(candles, safe.swing, last)
  const bosResult = detectBreakOfStructure(candles, swingResult.swings, safe.bos, last)
  const durationMs = performance.now() - started

  return {
    swings: swingResult.swings,
    bosEvents: bosResult.bosEvents,
    diagnostics: {
      detectorVersion: SMC_DETECTOR_VERSION,
      candleCount: candles.length,
      visibleThroughIndex: last,
      swingCandidatesConsidered: swingResult.candidatesConsidered,
      confirmedSwings: swingResult.swings.length,
      wickOnlyBreakCandidatesIgnored: bosResult.wickOnlyIgnored,
      validBosEvents: bosResult.bosEvents.length,
      repeatedBreaksIgnored: bosResult.repeatedBreaksIgnored,
      computationDurationMs: durationMs,
    },
  }
}

/** Full-history detection — equivalent to detectSmcUntil(..., candles.length - 1). */
export function detectSmc(
  candles: readonly Candle[],
  config: SmcDetectorConfig = DEFAULT_SMC_DETECTOR_CONFIG,
): SmcDetectionResult {
  if (candles.length === 0) {
    return {
      swings: [],
      bosEvents: [],
      diagnostics: emptyDiagnostics(0, null, 0),
    }
  }
  return detectSmcUntil(candles, candles.length - 1, config)
}

export function resolveSmcConfig(
  partial?: Partial<SmcDetectorConfig> | null,
): SmcDetectorConfig {
  if (!partial) return cloneSmcDetectorConfig()
  return validateSmcDetectorConfig(partial).config
}
