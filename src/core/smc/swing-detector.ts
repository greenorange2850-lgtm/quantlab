import type { Candle } from '@/data/candles'
import type { SmcSwingConfig, SmcSwingEvent } from './types'

function priceTolerance(price: number, tolerancePercent: number): number {
  return Math.abs(price) * (tolerancePercent / 100)
}

/**
 * Tie-breaking / equal-high rule:
 * Candidate high H is a Swing High if every surrounding high in the pivot window
 * is <= H + tolerance, AND no earlier contiguous equal-high (within tolerance)
 * exists to its left inside the left window (leftmost plateau wins).
 */
function isStrictlyDominatingHigh(
  candles: readonly Candle[],
  index: number,
  left: number,
  right: number,
  tolerancePercent: number,
): boolean {
  const candidate = candles[index]!
  const tol = priceTolerance(candidate.high, tolerancePercent)
  const start = index - left
  const end = index + right

  for (let i = start; i <= end; i++) {
    if (i === index) continue
    const other = candles[i]!
    if (other.high > candidate.high + tol) return false
  }

  // Leftmost equal plateau: if an earlier bar within left window equals
  // (within tolerance) and also dominates its own window's right side up to us,
  // prefer that earlier bar — skip this candidate.
  for (let i = start; i < index; i++) {
    const earlier = candles[i]!
    if (Math.abs(earlier.high - candidate.high) <= tol) {
      // Earlier equal high exists — leftmost wins.
      return false
    }
  }

  return true
}

function isStrictlyDominatingLow(
  candles: readonly Candle[],
  index: number,
  left: number,
  right: number,
  tolerancePercent: number,
): boolean {
  const candidate = candles[index]!
  const tol = priceTolerance(candidate.low, tolerancePercent)
  const start = index - left
  const end = index + right

  for (let i = start; i <= end; i++) {
    if (i === index) continue
    const other = candles[i]!
    if (other.low < candidate.low - tol) return false
  }

  for (let i = start; i < index; i++) {
    const earlier = candles[i]!
    if (Math.abs(earlier.low - candidate.low) <= tol) {
      return false
    }
  }

  return true
}

export interface SwingDetectionInternal {
  swings: SmcSwingEvent[]
  candidatesConsidered: number
}

/**
 * Detect confirmed pivot swings through `visibleThroughIndex` (inclusive).
 * A swing at N is only emitted when confirmedAtIndex <= visibleThroughIndex.
 */
export function detectConfirmedSwings(
  candles: readonly Candle[],
  config: SmcSwingConfig,
  visibleThroughIndex: number,
): SwingDetectionInternal {
  if (!config.enabled || candles.length === 0) {
    return { swings: [], candidatesConsidered: 0 }
  }

  const left = config.pivotLeft
  const right = config.pivotRight
  const last = Math.min(visibleThroughIndex, candles.length - 1)
  if (last < left + right) {
    return { swings: [], candidatesConsidered: 0 }
  }

  const swings: SmcSwingEvent[] = []
  let candidatesConsidered = 0

  // Candidate pivots that could already be confirmed by `last`.
  const maxPivotIndex = last - right
  for (let i = left; i <= maxPivotIndex; i++) {
    candidatesConsidered += 1
    const confirmedAtIndex = i + right
    if (confirmedAtIndex > last) continue

    const candle = candles[i]!
    const confirmCandle = candles[confirmedAtIndex]!

    if (isStrictlyDominatingHigh(candles, i, left, right, config.equalTolerancePercent)) {
      swings.push({
        id: `sh-${i}-${candle.time}`,
        kind: 'SWING_HIGH',
        candleIndex: i,
        timestamp: candle.time,
        price: candle.high,
        confirmedAtIndex,
        confirmedAtTimestamp: confirmCandle.time,
        leftBars: left,
        rightBars: right,
        reason: `Confirmed Swing High at index ${i}: high ${candle.high} dominates ${left} left + ${right} right bars (tolerance ${config.equalTolerancePercent}%). Confirmed at index ${confirmedAtIndex}.`,
      })
    }

    if (isStrictlyDominatingLow(candles, i, left, right, config.equalTolerancePercent)) {
      swings.push({
        id: `sl-${i}-${candle.time}`,
        kind: 'SWING_LOW',
        candleIndex: i,
        timestamp: candle.time,
        price: candle.low,
        confirmedAtIndex,
        confirmedAtTimestamp: confirmCandle.time,
        leftBars: left,
        rightBars: right,
        reason: `Confirmed Swing Low at index ${i}: low ${candle.low} dominates ${left} left + ${right} right bars (tolerance ${config.equalTolerancePercent}%). Confirmed at index ${confirmedAtIndex}.`,
      })
    }
  }

  return { swings, candidatesConsidered }
}
