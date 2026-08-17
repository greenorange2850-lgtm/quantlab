// ─── Playbook Engine — Detector Event Helpers ─────────────────────────────────
//
// Playbooks consume existing detector outputs. These helpers query the event
// stream without mutating it.

import type { PlaybookCandle, PlaybookEvent } from './types.js'

/** Events whose candle index (or timestamp) is visible at the evaluation point. */
export function eventsUpTo(events: PlaybookEvent[], index: number): PlaybookEvent[] {
  return events.filter((e) => (e.candleIndex ?? indexOfEvent(events, e)) <= index)
}

function indexOfEvent(events: PlaybookEvent[], target: PlaybookEvent): number {
  const idx = events.indexOf(target)
  return idx >= 0 ? idx : Number.MAX_SAFE_INTEGER
}

export function eventsForRule(
  events: PlaybookEvent[],
  ruleName: string,
  direction?: PlaybookEvent['direction'],
  withinBars = 0,
  endIndex = Number.MAX_SAFE_INTEGER,
): PlaybookEvent[] {
  return events.filter((e) => {
    if (e.ruleName !== ruleName) return false
    if (direction && e.direction !== direction) return false
    if (withinBars > 0) {
      const idx = e.candleIndex ?? Number.MAX_SAFE_INTEGER
      if (idx < endIndex - withinBars) return false
    }
    return true
  })
}

export function latestEvent(
  events: PlaybookEvent[],
  ruleName: string,
  direction?: PlaybookEvent['direction'],
  endIndex = Number.MAX_SAFE_INTEGER,
): PlaybookEvent | null {
  const matches = events.filter((e) => {
    if (e.ruleName !== ruleName) return false
    if (direction && e.direction !== direction) return false
    const idx = e.candleIndex ?? Number.MAX_SAFE_INTEGER
    return idx <= endIndex
  })
  matches.sort((a, b) => (a.candleIndex ?? 0) - (b.candleIndex ?? 0))
  return matches.length > 0 ? matches[matches.length - 1] : null
}

export interface ZoneProximity {
  event: PlaybookEvent
  distance: number
}

/**
 * Nearest event (of the given rules/direction) whose anchor overlaps the zone.
 * `anchor` extracts the event's price level (e.g. gapTop/gapBottom for FVG,
 * obHigh/obLow for OB).
 */
export function nearestEventNearZone(
  events: PlaybookEvent[],
  ruleNames: string[],
  direction: PlaybookEvent['direction'],
  zone: { top: number; bottom: number },
  endIndex: number,
  maxDistancePct = 0.01,
): PlaybookEvent | null {
  const candidates = events.filter((e) => {
    if (!ruleNames.includes(e.ruleName)) return false
    if (e.direction !== direction) return false
    const idx = e.candleIndex ?? Number.MAX_SAFE_INTEGER
    return idx <= endIndex
  })
  let best: PlaybookEvent | null = null
  let bestDist = Infinity
  for (const e of candidates) {
    const anchor = eventAnchor(e)
    if (anchor === null) continue
    const distance = Math.min(
      Math.abs(anchor - zone.top),
      Math.abs(anchor - zone.bottom),
    )
    const reference = Math.max(Math.abs(zone.top), Math.abs(zone.bottom), 1e-9)
    if (distance / reference <= maxDistancePct && distance < bestDist) {
      best = e
      bestDist = distance
    }
  }
  return best
}

function eventAnchor(e: PlaybookEvent): number | null {
  const m = e.metadata
  if (typeof m.level === 'number') return m.level
  if (typeof m.gapTop === 'number' && typeof m.gapBottom === 'number') {
    return (m.gapTop + m.gapBottom) / 2
  }
  if (typeof m.obHigh === 'number' && typeof m.obLow === 'number') {
    return (m.obHigh + m.obLow) / 2
  }
  if (typeof m.sweptLevel === 'number') return m.sweptLevel
  return null
}

export function eventHasTag(e: PlaybookEvent, tag: string): boolean {
  return e.tags.some((t) => t.toLowerCase().includes(tag.toLowerCase()))
}

/** Convert a frontend candle (time in ms) into the playbook candle shape. */
export function toPlaybookCandle(
  c: { time: number; open: number; high: number; low: number; close: number; volume: number },
): PlaybookCandle {
  return {
    timestamp: new Date(c.time).toISOString(),
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  }
}

export function toPlaybookCandles(
  candles: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>,
): PlaybookCandle[] {
  return candles.map(toPlaybookCandle)
}
