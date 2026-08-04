/**
 * Phase 6 — Zone Lifecycle Manager types.
 * Projection-only; never mutates detector events or zone objects from detectors.
 */

/** Canonical Phase 6 lifecycle states. */
export type ZoneLifecycleState =
  | 'NEW'
  | 'ACTIVE'
  | 'TOUCHED'
  | 'PARTIAL'
  | 'MITIGATED'
  | 'INVALIDATED'
  | 'EXPIRED'
  /** Liquidity / equal-level path (spec spelling). */
  | 'SWEEPED'
  /** Equal high/low path (alternate spelling kept for clarity). */
  | 'SWEPT'
  | 'CONSUMED'

export type ZoneLifecycleType =
  | 'BULLISH_FVG'
  | 'BEARISH_FVG'
  | 'BULLISH_ORDER_BLOCK'
  | 'BEARISH_ORDER_BLOCK'
  | 'LIQUIDITY_LEVEL'
  | 'EQUAL_HIGH'
  | 'EQUAL_LOW'

export type ZoneLifecycleDirection = 'BULLISH' | 'BEARISH'

export type ZoneLifecycleFamily = 'FVG' | 'ORDER_BLOCK' | 'LIQUIDITY' | 'EQUAL_LEVEL'

/** Immutable per-zone lifecycle metadata. */
export interface ZoneLifecycleMeta {
  id: string
  type: ZoneLifecycleType
  family: ZoneLifecycleFamily
  direction: ZoneLifecycleDirection

  createdIndex: number
  createdTime: number

  firstTouchIndex: number | null
  firstTouchTime: number | null

  mitigatedIndex: number | null
  invalidatedIndex: number | null
  expiredIndex: number | null

  currentState: ZoneLifecycleState
  previousState: ZoneLifecycleState | null

  touchCount: number
  /** 0–100; null when unknown / not applicable. */
  fillPercent: number | null
  ageCandles: number

  /** 0–100 projection importance (not detector confidence). */
  importance: number
  /** 0–1 weight used by visibility / fade. */
  visibilityWeight: number

  reason: string
  sourceEventId: string

  low: number
  high: number
  midpoint: number | null

  /** Inclusive chart extent at the progressive cursor. */
  startIndex: number
  endIndex: number
  extendsToVisibleEdge: boolean
}

export interface ZoneLifecycleTransitionInput {
  from: ZoneLifecycleState
  event:
    | 'PROMOTE'
    | 'TOUCH'
    | 'PARTIAL_FILL'
    | 'FULL_FILL'
    | 'MITIGATE'
    | 'INVALIDATE'
    | 'SWEEP'
    | 'CONSUME'
    | 'EXPIRE'
  family: ZoneLifecycleFamily
}

export interface ZoneLifecycleTransitionResult {
  ok: boolean
  to: ZoneLifecycleState
  reason: string
}

export interface ZoneLifecycleEngineInput {
  fvgEvents: readonly import('../types').SmcFvgEvent[]
  orderBlockEvents: readonly import('../types').SmcOrderBlockEvent[]
  equalLevelEvents: readonly import('../types').SmcEqualLevelEvent[]
  liquiditySweepEvents: readonly import('../types').SmcLiquiditySweepEvent[]
  /** Progressive cursor — future candles never affect past states. */
  visibleIndex: number
  /** Optional candle timestamps by index for createdTime / touch times. */
  candleTimes?: readonly number[]
  extendActiveRight?: boolean
  /** Age (candles) after mitigation/invalidation before EXPIRED. */
  expireAfterCandles?: number
}

export interface ZoneLifecycleEngineResult {
  visibleIndex: number
  zones: ZoneLifecycleMeta[]
  byId: Record<string, ZoneLifecycleMeta>
}

export interface ZoneLifecycleRenderStyle {
  opacity: number
  strokeDasharray: string | undefined
  showInvalidationCross: boolean
  hiddenByDefault: boolean
  labelSuffix: string
  fillClassHint: 'solid' | 'faded' | 'dashed' | 'low' | 'invalid' | 'hidden'
}

export type ZoneLifecycleVisibilityMode = 'active-only' | 'balanced' | 'history' | 'debug'

export interface ZoneLifecycleReport {
  zonesCreated: number
  active: number
  touched: number
  partial: number
  mitigated: number
  invalidated: number
  expired: number
  sweeped: number
  consumed: number
  averageLifetimeCandles: number
  byType: Record<ZoneLifecycleType, number>
  byState: Record<ZoneLifecycleState, number>
}

export const ZONE_LIFECYCLE_VERSION = 'zone-lifecycle-6.0.0'

export const DEFAULT_EXPIRE_AFTER_CANDLES = 48
