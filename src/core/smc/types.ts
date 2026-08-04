import type { Candle } from '@/data/candles'

/** Phase-1 detection kinds only. */
export type SmcDetectionKind =
  | 'SWING_HIGH'
  | 'SWING_LOW'
  | 'BULLISH_BOS'
  | 'BEARISH_BOS'

export const SMC_DETECTOR_VERSION = '1.0.0-phase1'

export interface SmcSwingConfig {
  enabled: boolean
  /** Bars to the left of the pivot that must be strictly dominated. */
  pivotLeft: number
  /** Future bars required before the swing is confirmed (no look-ahead). */
  pivotRight: number
  /**
   * Equal high/low tolerance as a percent of price.
   * Tie-breaking rule (documented):
   * - A candidate is a Swing High when its high is >= every surrounding high
   *   within equalTolerancePercent (i.e. neighbors may equal within tolerance,
   *   but none may exceed beyond tolerance).
   * - When multiple contiguous candles share an equal extreme within tolerance,
   *   the LEFTMOST (earliest) candle in that plateau is the pivot.
   * - Confirmation still waits for pivotRight closed bars after that pivot.
   */
  equalTolerancePercent: number
}

export interface SmcBosConfig {
  enabled: boolean
  /** Phase 1 only supports close confirmation. */
  breakMode: 'CLOSE'
  /** Minimum break distance as percent of swing price. */
  minimumBreakPercent: number
  /** Only break the latest eligible confirmed swing of each type. */
  requireLatestConfirmedSwing: boolean
  /** When false, each swing is broken at most once. */
  allowRepeatedBreaksOfSameSwing: boolean
}

export interface SmcDetectorConfig {
  swing: SmcSwingConfig
  bos: SmcBosConfig
}

export interface SmcSwingEvent {
  id: string
  kind: 'SWING_HIGH' | 'SWING_LOW'
  candleIndex: number
  timestamp: number
  price: number
  confirmedAtIndex: number
  confirmedAtTimestamp: number
  leftBars: number
  rightBars: number
  reason: string
}

export interface SmcBosEvent {
  id: string
  kind: 'BULLISH_BOS' | 'BEARISH_BOS'
  /** Break candle index — never the swing index. */
  candleIndex: number
  /** Break candle timestamp — never the swing timestamp. */
  timestamp: number
  closePrice: number
  brokenSwingId: string
  brokenSwingPrice: number
  brokenSwingTimestamp: number
  brokenSwingCandleIndex: number
  brokenSwingConfirmedAtIndex: number
  breakAmount: number
  breakPercent: number
  wickHigh: number
  wickLow: number
  wickOnlyIgnored: boolean
  reason: string
}

export interface SmcInvariantCounts {
  invalidBullishBosCount: number
  invalidBearishBosCount: number
  bosBeforeConfirmationCount: number
  repeatedSwingBreakCount: number
  eventTimestampMismatchCount: number
}

export interface SmcDetectionDiagnostics {
  detectorVersion: string
  candleCount: number
  visibleThroughIndex: number | null
  swingCandidatesConsidered: number
  confirmedSwings: number
  wickOnlyBreakCandidatesIgnored: number
  validBosEvents: number
  repeatedBreaksIgnored: number
  computationDurationMs: number
  /** Present after pipeline invariant audit. All must be 0 for a complete result. */
  invariants?: SmcInvariantCounts & { ok: boolean }
}

export interface SmcDetectionResult {
  swings: SmcSwingEvent[]
  bosEvents: SmcBosEvent[]
  diagnostics: SmcDetectionDiagnostics
}

export type SmcEvent = SmcSwingEvent | SmcBosEvent

export type { Candle }
