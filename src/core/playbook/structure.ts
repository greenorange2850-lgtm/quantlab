// ─── Playbook Engine — Market Structure Utilities ─────────────────────────────
//
// Pure functions over candles. Playbooks never "detect" new patterns from
// arbitrary candles: QML zones and structure checks are derived from broken
// structural swings and, when available, existing detector events.

import type { PlaybookCandle } from './types.js'

export interface SwingPoint {
  index: number
  price: number
  timestamp: string
}

export function atr(candles: PlaybookCandle[], period: number, index: number): number {
  if (index < 1 || candles.length < 2) return 0
  const start = Math.max(1, index - period + 1)
  let sum = 0
  let count = 0
  for (let i = start; i <= index; i++) {
    const prev = candles[i - 1]
    const cur = candles[i]
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close),
    )
    sum += tr
    count++
  }
  return count > 0 ? sum / count : 0
}

export function findSwingHighs(candles: PlaybookCandle[], lookback = 5): SwingPoint[] {
  const out: SwingPoint[] = []
  if (lookback < 1) lookback = 1
  for (let i = lookback; i < candles.length - lookback; i++) {
    let isSwing = true
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && candles[j].high >= candles[i].high) {
        isSwing = false
        break
      }
    }
    if (isSwing) out.push({ index: i, price: candles[i].high, timestamp: candles[i].timestamp })
  }
  return out
}

export function findSwingLows(candles: PlaybookCandle[], lookback = 5): SwingPoint[] {
  const out: SwingPoint[] = []
  if (lookback < 1) lookback = 1
  for (let i = lookback; i < candles.length - lookback; i++) {
    let isSwing = true
    for (let j = i - lookback; j <= i + lookback; j++) {
      if (j !== i && candles[j].low <= candles[i].low) {
        isSwing = false
        break
      }
    }
    if (isSwing) out.push({ index: i, price: candles[i].low, timestamp: candles[i].timestamp })
  }
  return out
}

/** Sequence of swing highs restricted to candles seen up to `index`. */
export function swingHighsUpTo(candles: PlaybookCandle[], index: number, lookback: number): SwingPoint[] {
  return findSwingHighs(candles.slice(0, index + 1), lookback)
}

export function swingLowsUpTo(candles: PlaybookCandle[], index: number, lookback: number): SwingPoint[] {
  return findSwingLows(candles.slice(0, index + 1), lookback)
}

export type StructureTrend = 'bullish' | 'bearish' | 'neutral'

/**
 * Structure-derived trend based on the latest swing sequence:
 * higher highs + higher lows → bullish; lower highs + lower lows → bearish.
 */
export function detectStructureTrend(
  candles: PlaybookCandle[],
  index: number,
  lookback = 5,
): StructureTrend {
  const highs = swingHighsUpTo(candles, index, lookback)
  const lows = swingLowsUpTo(candles, index, lookback)
  if (highs.length < 2 && lows.length < 2) return 'neutral'

  let bullishScore = 0
  let bearishScore = 0
  const highDeltas: boolean[] = []
  const lowDeltas: boolean[] = []
  for (let i = 1; i < highs.length; i++) {
    const higher = highs[i].price > highs[i - 1].price
    highDeltas.push(higher)
    if (higher) bullishScore++
    else bearishScore++
  }
  for (let i = 1; i < lows.length; i++) {
    const higher = lows[i].price > lows[i - 1].price
    lowDeltas.push(higher)
    if (higher) bullishScore++
    else bearishScore++
  }

  if (bearishScore >= 2 && bearishScore > bullishScore) return 'bearish'
  if (bullishScore >= 2 && bullishScore > bearishScore) return 'bullish'
  return 'neutral'
}

/** Consecutive lower highs — requires at least `count` of them in sequence. */
export function hasLowerHighs(candles: PlaybookCandle[], index: number, lookback: number, count = 2): boolean {
  const highs = swingHighsUpTo(candles, index, lookback)
  let consecutive = 0
  for (let i = 1; i < highs.length; i++) {
    if (highs[i].price < highs[i - 1].price) {
      consecutive++
      if (consecutive >= count) return true
    } else {
      consecutive = 0
    }
  }
  return false
}

export function hasLowerLows(candles: PlaybookCandle[], index: number, lookback: number, count = 2): boolean {
  const lows = swingLowsUpTo(candles, index, lookback)
  let consecutive = 0
  for (let i = 1; i < lows.length; i++) {
    if (lows[i].price < lows[i - 1].price) {
      consecutive++
      if (consecutive >= count) return true
    } else {
      consecutive = 0
    }
  }
  return false
}

export function hasHigherHighs(candles: PlaybookCandle[], index: number, lookback: number, count = 2): boolean {
  const highs = swingHighsUpTo(candles, index, lookback)
  let consecutive = 0
  for (let i = 1; i < highs.length; i++) {
    if (highs[i].price > highs[i - 1].price) {
      consecutive++
      if (consecutive >= count) return true
    } else {
      consecutive = 0
    }
  }
  return false
}

export function hasHigherLows(candles: PlaybookCandle[], index: number, lookback: number, count = 2): boolean {
  const lows = swingLowsUpTo(candles, index, lookback)
  let consecutive = 0
  for (let i = 1; i < lows.length; i++) {
    if (lows[i].price > lows[i - 1].price) {
      consecutive++
      if (consecutive >= count) return true
    } else {
      consecutive = 0
    }
  }
  return false
}

// ─── Broken swing → QML zone ──────────────────────────────────────────────────

export interface BrokenSwingZone {
  swing: SwingPoint
  brokenAtIndex: number
  brokenAtPrice: number
  zone: { top: number; bottom: number }
}

/**
 * For a bullish QML the broken structural swing is a lower high whose high was
 * closed above. For bearish QML it is a higher low whose low was closed below.
 * The zone is anchored on the broken swing itself — never on arbitrary candles.
 */
export function findBrokenSwingZone(
  candles: PlaybookCandle[],
  index: number,
  lookback: number,
  direction: 'bullish' | 'bearish',
): BrokenSwingZone | null {
  if (direction === 'bullish') {
    const highs = swingHighsUpTo(candles, index, lookback)
    // Most recent swing high first.
    for (let i = highs.length - 1; i >= 0; i--) {
      const swing = highs[i]
      // Only consider swings followed by at least one more swing (valid LH pair).
      if (i === 0) continue
      const prevHigh = highs[i - 1]
      if (swing.price >= prevHigh.price) continue
      // Find a close above the broken level strictly after the swing.
      for (let j = swing.index + 1; j <= index; j++) {
        if (candles[j].close > swing.price) {
          const followingLow = candles.slice(swing.index + 1, j + 1)
            .reduce((min, c) => Math.min(min, c.low), Infinity)
          const swingLow = followingLow === Infinity ? swing.price : followingLow
          return {
            swing,
            brokenAtIndex: j,
            brokenAtPrice: candles[j].close,
            zone: {
              top: swing.price,
              bottom: Math.min(swingLow, candles[j].low, swing.price),
            },
          }
        }
      }
    }
    return null
  }

  const lows = swingLowsUpTo(candles, index, lookback)
  for (let i = lows.length - 1; i >= 0; i--) {
    const swing = lows[i]
    if (i === 0) continue
    const prevLow = lows[i - 1]
    if (swing.price <= prevLow.price) continue
    for (let j = swing.index + 1; j <= index; j++) {
      if (candles[j].close < swing.price) {
        const followingHigh = candles.slice(swing.index + 1, j + 1)
          .reduce((max, c) => Math.max(max, c.high), -Infinity)
        const swingHigh = followingHigh === -Infinity ? swing.price : followingHigh
        return {
          swing,
          brokenAtIndex: j,
          brokenAtPrice: candles[j].close,
          zone: {
            top: Math.max(swingHigh, candles[j].high, swing.price),
            bottom: swing.price,
          },
        }
      }
    }
  }
  return null
}

// ─── Zone lifecycle ───────────────────────────────────────────────────────────

export interface ZoneLifecycleStatus {
  alive: boolean
  ageBars: number
  touchedCount: number
  reason?: string
}

/** Count how many candles wick into the zone within [start, index]. */
export function countZoneTouches(
  zone: { top: number; bottom: number },
  candles: PlaybookCandle[],
  start: number,
  index: number,
): number {
  let touches = 0
  for (let i = start; i <= index; i++) {
    const c = candles[i]
    if (c.high >= zone.bottom && c.low <= zone.top) touches++
  }
  return touches
}

/**
 * Zone lifecycle: a zone is alive while price has not exceeded the far side
 * (structural invalidation), its age stays under `maxAge` and its touch count
 * stays under `maxTouches`.
 */
export function evaluateZoneLifecycle(
  zone: { top: number; bottom: number },
  candles: PlaybookCandle[],
  formedAtIndex: number,
  index: number,
  maxAge: number,
  maxTouches: number,
  direction: 'long' | 'short',
): ZoneLifecycleStatus {
  const ageBars = index - formedAtIndex
  // Touches are counted from the candle after formation: the candle that
  // created the zone (break / event) is part of the setup, not a touch.
  const touchedCount = countZoneTouches(zone, candles, formedAtIndex + 1, index)

  let invalidated = false
  let reason: string | undefined
  for (let i = formedAtIndex; i <= index; i++) {
    const c = candles[i]
    if (direction === 'long' && c.low < zone.bottom) {
      invalidated = true
      reason = `Price closed below zone bottom (${zone.bottom.toFixed(5)})`
      break
    }
    if (direction === 'short' && c.high > zone.top) {
      invalidated = true
      reason = `Price closed above zone top (${zone.top.toFixed(5)})`
      break
    }
  }

  if (invalidated) {
    return { alive: false, ageBars, touchedCount, reason }
  }
  if (ageBars > maxAge) {
    return {
      alive: false,
      ageBars,
      touchedCount,
      reason: `Zone too old (${ageBars} bars > ${maxAge})`,
    }
  }
  if (touchedCount > maxTouches) {
    return {
      alive: false,
      ageBars,
      touchedCount,
      reason: `Zone touched ${touchedCount} times > ${maxTouches}`,
    }
  }
  return { alive: true, ageBars, touchedCount }
}

// ─── Displacement / rejection helpers ─────────────────────────────────────────

/** Strong impulse candle — body above `multiplier` x average body. */
export function hasDisplacement(
  candles: PlaybookCandle[],
  index: number,
  mult = 2,
  lookback = 10,
): boolean {
  if (index < 2) return false
  const c = candles[index]
  const body = Math.abs(c.close - c.open)
  const start = Math.max(0, index - lookback)
  let sum = 0
  let n = 0
  for (let i = start; i < index; i++) {
    sum += Math.abs(candles[i].close - candles[i].open)
    n++
  }
  const avg = n > 0 ? sum / n : 0
  return body > avg * mult
}

/**
 * Bullish rejection — a candle that rejects the zone low: long lower wick and
 * close in the upper portion of its range.
 */
export function isBullishRejection(c: PlaybookCandle): boolean {
  const range = c.high - c.low
  if (range <= 0) return false
  const lowerWick = Math.min(c.open, c.close) - c.low
  const closePosition = (c.close - c.low) / range
  return lowerWick > range * 0.4 && closePosition > 0.55
}

export function isBearishRejection(c: PlaybookCandle): boolean {
  const range = c.high - c.low
  if (range <= 0) return false
  const upperWick = c.high - Math.max(c.open, c.close)
  const closePosition = (c.high - c.close) / range
  return upperWick > range * 0.4 && closePosition > 0.55
}

/** Structure-derived sweep: wick beyond the nearest swing then close back. */
export function detectSweep(
  candles: PlaybookCandle[],
  index: number,
  lookback: number,
  tolerance: number,
  direction: 'long' | 'short',
): { sweptLevel: number; swingIndex: number } | null {
  if (direction === 'long') {
    const lows = swingLowsUpTo(candles, index - 1, lookback)
    if (lows.length === 0) return null
    const low = lows[lows.length - 1]
    const c = candles[index]
    if (c.low < low.price * (1 - tolerance) && c.close > low.price) {
      return { sweptLevel: low.price, swingIndex: low.index }
    }
    return null
  }
  const highs = swingHighsUpTo(candles, index - 1, lookback)
  if (highs.length === 0) return null
  const high = highs[highs.length - 1]
  const c = candles[index]
  if (c.high > high.price * (1 + tolerance) && c.close < high.price) {
    return { sweptLevel: high.price, swingIndex: high.index }
  }
  return null
}
