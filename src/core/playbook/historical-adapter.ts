// ─── Playbook Engine — Historical Candle / Event Adapter ──────────────────────
//
// Pure, deterministic conversion of existing QuantLab OHLCV candles into
// PlaybookCandle[]. Reuses toPlaybookCandle — does not invent a second candle
// type or rerun detectors.

import { toPlaybookCandle } from './events.js'
import type { PlaybookCandle, PlaybookEvent, PlaybookKind } from './types.js'

/** Structural subset of `@/data/candles` Candle (time in epoch milliseconds). */
export interface QuantLabOhlcvCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export class HistoricalCandleAdapterError extends Error {
  readonly code = 'HISTORICAL_CANDLE_ADAPTER' as const
  readonly candleIndex: number | null

  constructor(message: string, candleIndex: number | null = null) {
    super(message)
    this.name = 'HistoricalCandleAdapterError'
    this.candleIndex = candleIndex
  }
}

/**
 * Convert one QuantLab/replay candle into the playbook engine shape.
 * Index is the source array index — the same cursor Backtest Replay uses.
 */
export function adaptHistoricalCandle(
  candle: QuantLabOhlcvCandle,
  candleIndex = 0,
): PlaybookCandle {
  assertValidQuantLabCandle(candle, candleIndex)
  return toPlaybookCandle(candle)
}

/**
 * Convert a QuantLab/replay candle series. Order is preserved so
 * `result[i]` maps to replay `candleIndex === i` and `timestamp` on that bar.
 */
export function adaptHistoricalCandles(
  candles: readonly QuantLabOhlcvCandle[],
): PlaybookCandle[] {
  const out: PlaybookCandle[] = []
  for (let i = 0; i < candles.length; i++) {
    out.push(adaptHistoricalCandle(candles[i]!, i))
  }
  return out
}

export function assertValidQuantLabCandle(
  candle: QuantLabOhlcvCandle,
  candleIndex: number,
): void {
  if (!candle || typeof candle !== 'object') {
    throw new HistoricalCandleAdapterError(
      `Invalid candle at index ${candleIndex}: expected an OHLCV object`,
      candleIndex,
    )
  }
  const fields: Array<keyof QuantLabOhlcvCandle> = [
    'time',
    'open',
    'high',
    'low',
    'close',
    'volume',
  ]
  for (const field of fields) {
    const value = candle[field]
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new HistoricalCandleAdapterError(
        `Invalid candle at index ${candleIndex}: "${field}" must be a finite number`,
        candleIndex,
      )
    }
  }
}

// ─── Detector event requirements ──────────────────────────────────────────────

export const PLAYBOOK_DETECTOR_RULES = {
  bos: 'BOS',
  choch: 'CHOCH',
  fvg: 'FVG',
  orderBlock: 'Order Block',
  liquiditySweep: 'Liquidity Sweep',
} as const

export interface PlaybookEventRequirement {
  kind: PlaybookKind
  /** True when the playbook can produce a valid setup from candles alone. */
  candleOnly: boolean
  /** Detector rule names that are required for the playbook to arm. */
  requiredRuleNames: readonly string[]
  /**
   * Zone rules where at least one must be present when the playbook is not
   * candle-only. Continuation needs FVG or Order Block (not both).
   */
  requiredAnyRuleNames: readonly string[]
  /** Detector rules the evaluator will consume when present (never fabricated). */
  optionalRuleNames: readonly string[]
  summary: string
}

export const PLAYBOOK_EVENT_REQUIREMENTS: Record<PlaybookKind, PlaybookEventRequirement> = {
  'qml-reversal': {
    kind: 'qml-reversal',
    candleOnly: true,
    requiredRuleNames: [],
    requiredAnyRuleNames: [],
    optionalRuleNames: [
      PLAYBOOK_DETECTOR_RULES.choch,
      PLAYBOOK_DETECTOR_RULES.fvg,
      PLAYBOOK_DETECTOR_RULES.orderBlock,
      PLAYBOOK_DETECTOR_RULES.liquiditySweep,
    ],
    summary:
      'QML Reversal evaluates structure from candles. CHoCH falls back to the structural break; ' +
      'FVG/OB confluence needs detector events when those optional gates are enabled.',
  },
  continuation: {
    kind: 'continuation',
    candleOnly: false,
    requiredRuleNames: [PLAYBOOK_DETECTOR_RULES.bos],
    requiredAnyRuleNames: [PLAYBOOK_DETECTOR_RULES.fvg, PLAYBOOK_DETECTOR_RULES.orderBlock],
    optionalRuleNames: [PLAYBOOK_DETECTOR_RULES.liquiditySweep, PLAYBOOK_DETECTOR_RULES.choch],
    summary:
      'Continuation requires detector events: a BOS in trend direction and an active FVG or Order Block zone. ' +
      'Those events are not derived from candles inside the playbook engine.',
  },
}

export interface DetectorEventInspection {
  requirement: PlaybookEventRequirement
  presentRuleNames: string[]
  missingRequiredRuleNames: string[]
  missingRequiredAny: boolean
  /** True when the playbook cannot arm without detector events that are absent. */
  blocked: boolean
  detail: string
}

export function inspectPlaybookEventSupport(
  kind: PlaybookKind,
  events: readonly PlaybookEvent[],
): DetectorEventInspection {
  const requirement = PLAYBOOK_EVENT_REQUIREMENTS[kind]
  const present = new Set<string>()
  for (const event of events) {
    if (event.ruleName) present.add(event.ruleName)
  }
  const presentRuleNames = [...present].sort()
  const missingRequiredRuleNames = requirement.requiredRuleNames.filter((name) => !present.has(name))
  const missingRequiredAny =
    requirement.requiredAnyRuleNames.length > 0 &&
    !requirement.requiredAnyRuleNames.some((name) => present.has(name))
  const blocked = missingRequiredRuleNames.length > 0 || missingRequiredAny

  let detail: string
  if (requirement.candleOnly && events.length === 0) {
    detail =
      'No detector events in this dataset. QML Reversal still evaluates from candles; ' +
      'optional FVG/OB/sweep confluence is unavailable unless those events are supplied.'
  } else if (blocked) {
    const missing = [
      ...missingRequiredRuleNames,
      ...(missingRequiredAny
        ? [`${requirement.requiredAnyRuleNames.join(' or ')}`]
        : []),
    ]
    detail =
      `This playbook requires detector events that are not present: ${missing.join(', ')}. ` +
      'Events were not fabricated and no alternate detector was run.'
  } else if (events.length === 0) {
    detail = requirement.summary
  } else {
    detail = `Detector events present: ${presentRuleNames.join(', ') || 'none'}.`
  }

  return {
    requirement,
    presentRuleNames,
    missingRequiredRuleNames,
    missingRequiredAny,
    blocked,
    detail,
  }
}

const PLAYBOOK_DIRECTIONS: ReadonlySet<PlaybookEvent['direction']> = new Set([
  'bullish',
  'bearish',
  'neutral',
  'warning',
  'rejected',
])

const EXECUTION_EVENT_KINDS = new Set([
  'signal_evaluated',
  'signal_queued',
  'order_skipped',
  'fill_applied',
  'trade_opened',
  'trade_closed',
])

/**
 * Accept existing playbook/detector events only. Backtest execution traces are
 * a different domain and are never converted into BOS/FVG/OB/CHoCH events.
 */
export function adaptHistoricalDetectorEvents(raw: unknown): {
  events: PlaybookEvent[]
  ignoredExecutionEvents: number
  rejectedCount: number
} {
  if (raw == null) {
    return { events: [], ignoredExecutionEvents: 0, rejectedCount: 0 }
  }
  if (!Array.isArray(raw)) {
    return { events: [], ignoredExecutionEvents: 0, rejectedCount: 1 }
  }

  const events: PlaybookEvent[] = []
  let ignoredExecutionEvents = 0
  let rejectedCount = 0

  for (const item of raw) {
    if (isPlaybookEvent(item)) {
      events.push(item)
      continue
    }
    if (isExecutionEvent(item)) {
      ignoredExecutionEvents += 1
      continue
    }
    rejectedCount += 1
  }

  return { events, ignoredExecutionEvents, rejectedCount }
}

export function isPlaybookEvent(value: unknown): value is PlaybookEvent {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (typeof v.ruleName !== 'string' || v.ruleName.length === 0) return false
  if (typeof v.timestamp !== 'string' || v.timestamp.length === 0) return false
  if (typeof v.id !== 'string') return false
  if (typeof v.ruleId !== 'string') return false
  if (typeof v.direction !== 'string' || !PLAYBOOK_DIRECTIONS.has(v.direction as PlaybookEvent['direction'])) {
    return false
  }
  if (typeof v.confidence !== 'number' || typeof v.score !== 'number') return false
  if (!Array.isArray(v.tags)) return false
  if (!v.metadata || typeof v.metadata !== 'object') return false
  return true
}

function isExecutionEvent(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.kind === 'string' && EXECUTION_EVENT_KINDS.has(v.kind)
}
