import type { Candle } from '@/data/candles'
import { isBearishCandle, isBullishCandle } from '@/core/indicators/atr'
import type {
  SmcBosEvent,
  SmcChochEvent,
  SmcDisplacementEvent,
  SmcEventRef,
  SmcFvgEvent,
  SmcOrderBlockConfig,
  SmcOrderBlockEvent,
  SmcZoneState,
} from './types'

export interface OrderBlockDetectionInternal {
  events: SmcOrderBlockEvent[]
}

interface ActiveOb {
  id: string
  direction: 'BULLISH' | 'BEARISH'
  sourceCandleIndex: number
  sourceCandleTimestamp: number
  zoneHigh: number
  zoneLow: number
  midpoint: number
  createdIndex: number
  createdTimestamp: number
  firstRetestTimestamp: number | null
  mitigationStatus: SmcZoneState
  invalidationStatus: boolean
  sourceBreakId: string
  sourceBreakKind: SmcBosEvent['kind'] | SmcChochEvent['kind']
  sourceDisplacementId: string | null
  sourceFvgId: string | null
  eventChain: SmcEventRef[]
  reason: string
}

function zoneBounds(
  candle: Candle,
  direction: 'BULLISH' | 'BEARISH',
  mode: SmcOrderBlockConfig['zoneMode'],
): { high: number; low: number } {
  if (mode === 'FULL_CANDLE') return { high: candle.high, low: candle.low }
  if (mode === 'BODY') {
    return {
      high: Math.max(candle.open, candle.close),
      low: Math.min(candle.open, candle.close),
    }
  }
  // OPEN_TO_EXTREME
  if (direction === 'BULLISH') {
    return { high: candle.open, low: candle.low }
  }
  return { high: candle.high, low: candle.open }
}

function findSourceCandle(
  candles: readonly Candle[],
  breakIndex: number,
  direction: 'BULLISH' | 'BEARISH',
  searchBackBars: number,
): { index: number; candle: Candle } | null {
  const start = Math.max(0, breakIndex - searchBackBars)
  for (let i = breakIndex - 1; i >= start; i--) {
    const c = candles[i]!
    if (direction === 'BULLISH' && isBearishCandle(c)) {
      return { index: i, candle: c }
    }
    if (direction === 'BEARISH' && isBullishCandle(c)) {
      return { index: i, candle: c }
    }
  }
  return null
}

/**
 * Order Block detector — runs after BOS/CHoCH, displacement, and optional FVG.
 * Source candle must precede displacement and break (no future selection).
 */
export function detectOrderBlocks(
  candles: readonly Candle[],
  bosEvents: readonly SmcBosEvent[],
  chochEvents: readonly SmcChochEvent[],
  displacements: readonly SmcDisplacementEvent[],
  fvgs: readonly SmcFvgEvent[],
  config: SmcOrderBlockConfig,
  visibleThroughIndex: number,
): OrderBlockDetectionInternal {
  if (!config.enabled || candles.length === 0) {
    return { events: [] }
  }

  const last = Math.min(visibleThroughIndex, candles.length - 1)
  const events: SmcOrderBlockEvent[] = []
  const active: ActiveOb[] = []

  const breaks: Array<SmcBosEvent | SmcChochEvent> = []
  if (config.sourceBreak === 'BOS' || config.sourceBreak === 'BOTH') {
    breaks.push(...bosEvents)
  }
  if (config.sourceBreak === 'CHOCH' || config.sourceBreak === 'BOTH') {
    breaks.push(...chochEvents)
  }
  breaks.sort((a, b) => a.candleIndex - b.candleIndex)

  for (const brk of breaks) {
    if (brk.candleIndex > last) continue
    const bullish = brk.kind === 'BULLISH_BOS' || brk.kind === 'BULLISH_CHOCH'
    const direction: 'BULLISH' | 'BEARISH' = bullish ? 'BULLISH' : 'BEARISH'

    const disp =
      displacements.find(
        (d) =>
          d.candleIndex >= brk.candleIndex &&
          d.candleIndex <= brk.candleIndex + 1 &&
          ((bullish && d.kind === 'BULLISH_DISPLACEMENT') ||
            (!bullish && d.kind === 'BEARISH_DISPLACEMENT')),
      ) ??
      displacements.find(
        (d) =>
          d.structureBreakId === brk.id ||
          (d.candleIndex === brk.candleIndex &&
            ((bullish && d.kind === 'BULLISH_DISPLACEMENT') ||
              (!bullish && d.kind === 'BEARISH_DISPLACEMENT'))),
      ) ??
      null

    if (config.requireDisplacement && !disp) continue

    const dispIndex = disp?.candleIndex ?? brk.candleIndex
    const source = findSourceCandle(
      candles,
      Math.min(dispIndex, brk.candleIndex),
      direction,
      config.searchBackBars,
    )
    if (!source) continue
    // Hard invariant: source precedes displacement and break.
    if (source.index >= brk.candleIndex) continue
    if (disp && source.index >= disp.candleIndex) continue

    const fvg =
      fvgs.find(
        (f) =>
          (f.kind === 'BULLISH_FVG_CREATED' || f.kind === 'BEARISH_FVG_CREATED') &&
          f.candleIndex >= brk.candleIndex - 1 &&
          f.candleIndex <= brk.candleIndex + 2 &&
          ((bullish && f.direction === 'BULLISH') || (!bullish && f.direction === 'BEARISH')),
      ) ?? null
    if (config.requireFvg && !fvg) continue

    const bounds = zoneBounds(source.candle, direction, config.zoneMode)
    const id = `ob-${bullish ? 'bull' : 'bear'}-${source.index}-${brk.id}`
    const chain: SmcEventRef[] = [
      { id: brk.brokenSwingId, kind: bullish ? 'SWING_HIGH' : 'SWING_LOW' },
      { id: brk.id, kind: brk.kind },
    ]
    if (disp) chain.push({ id: disp.id, kind: disp.kind })
    if (fvg) chain.push({ id: fvg.id, kind: fvg.kind })

    const ob: ActiveOb = {
      id,
      direction,
      sourceCandleIndex: source.index,
      sourceCandleTimestamp: source.candle.time,
      zoneHigh: bounds.high,
      zoneLow: bounds.low,
      midpoint: (bounds.high + bounds.low) / 2,
      createdIndex: brk.candleIndex,
      createdTimestamp: brk.timestamp,
      firstRetestTimestamp: null,
      mitigationStatus: 'ACTIVE',
      invalidationStatus: false,
      sourceBreakId: brk.id,
      sourceBreakKind: brk.kind,
      sourceDisplacementId: disp?.id ?? null,
      sourceFvgId: fvg?.id ?? null,
      eventChain: chain,
      reason: [
        `${direction} Order Block from candle ${source.index} linked to ${brk.kind} ${brk.id}.`,
        disp ? `Displacement ${disp.id}.` : 'No displacement link.',
        fvg ? `FVG ${fvg.id}.` : 'No FVG link.',
      ].join(' '),
    }
    active.push(ob)
    events.push(toCreatedEvent(ob))
  }

  // Mitigation / invalidation after creation
  for (let i = 0; i <= last; i++) {
    const candle = candles[i]!
    for (const ob of active) {
      if (ob.invalidationStatus || ob.mitigationStatus === 'INVALIDATED') continue
      if (i <= ob.createdIndex) continue

      const beyond =
        ob.direction === 'BULLISH'
          ? config.invalidationMode === 'CLOSE_BEYOND'
            ? candle.close < ob.zoneLow
            : candle.low < ob.zoneLow
          : config.invalidationMode === 'CLOSE_BEYOND'
            ? candle.close > ob.zoneHigh
            : candle.high > ob.zoneHigh

      if (beyond) {
        ob.invalidationStatus = true
        ob.mitigationStatus = 'INVALIDATED'
        events.push(toStateEvent(ob, 'ORDER_BLOCK_INVALIDATED', i, candle.time))
        continue
      }

      if (!config.trackMitigation) continue

      const touched =
        ob.direction === 'BULLISH'
          ? candle.low <= ob.zoneHigh && candle.high >= ob.zoneLow
          : candle.high >= ob.zoneLow && candle.low <= ob.zoneHigh

      if (!touched) continue
      if (ob.firstRetestTimestamp == null) ob.firstRetestTimestamp = candle.time

      if (ob.mitigationStatus === 'ACTIVE') {
        ob.mitigationStatus = 'TOUCHED'
        events.push(toStateEvent(ob, 'ORDER_BLOCK_TOUCHED', i, candle.time))
      }

      let mitigated = false
      if (config.mitigationMode === 'TOUCH') {
        mitigated = true
      } else if (config.mitigationMode === 'MIDPOINT') {
        mitigated =
          ob.direction === 'BULLISH'
            ? candle.low <= ob.midpoint
            : candle.high >= ob.midpoint
      } else {
        // FULL_FILL
        mitigated =
          ob.direction === 'BULLISH'
            ? candle.low <= ob.zoneLow
            : candle.high >= ob.zoneHigh
      }

      if (mitigated && ob.mitigationStatus !== 'MITIGATED') {
        ob.mitigationStatus = 'MITIGATED'
        events.push(toStateEvent(ob, 'ORDER_BLOCK_MITIGATED', i, candle.time))
      }
    }
  }

  return { events }
}

function toCreatedEvent(ob: ActiveOb): SmcOrderBlockEvent {
  return {
    id: `${ob.id}-created`,
    kind:
      ob.direction === 'BULLISH'
        ? 'BULLISH_ORDER_BLOCK_CREATED'
        : 'BEARISH_ORDER_BLOCK_CREATED',
    candleIndex: ob.createdIndex,
    timestamp: ob.createdTimestamp,
    orderBlockId: ob.id,
    direction: ob.direction,
    sourceCandleIndex: ob.sourceCandleIndex,
    sourceCandleTimestamp: ob.sourceCandleTimestamp,
    zoneHigh: ob.zoneHigh,
    zoneLow: ob.zoneLow,
    midpoint: ob.midpoint,
    createdTimestamp: ob.createdTimestamp,
    firstRetestTimestamp: null,
    mitigationStatus: 'ACTIVE',
    invalidationStatus: false,
    sourceBreakId: ob.sourceBreakId,
    sourceBreakKind: ob.sourceBreakKind,
    sourceDisplacementId: ob.sourceDisplacementId,
    sourceFvgId: ob.sourceFvgId,
    reason: ob.reason,
    refs: ob.eventChain,
    eventChain: ob.eventChain,
  }
}

function toStateEvent(
  ob: ActiveOb,
  kind: SmcOrderBlockEvent['kind'],
  index: number,
  timestamp: number,
): SmcOrderBlockEvent {
  return {
    id: `${ob.id}-${kind}-${index}`,
    kind,
    candleIndex: index,
    timestamp,
    orderBlockId: ob.id,
    direction: ob.direction,
    sourceCandleIndex: ob.sourceCandleIndex,
    sourceCandleTimestamp: ob.sourceCandleTimestamp,
    zoneHigh: ob.zoneHigh,
    zoneLow: ob.zoneLow,
    midpoint: ob.midpoint,
    createdTimestamp: ob.createdTimestamp,
    firstRetestTimestamp: ob.firstRetestTimestamp,
    mitigationStatus: ob.mitigationStatus,
    invalidationStatus: ob.invalidationStatus,
    sourceBreakId: ob.sourceBreakId,
    sourceBreakKind: ob.sourceBreakKind,
    sourceDisplacementId: ob.sourceDisplacementId,
    sourceFvgId: ob.sourceFvgId,
    reason: `${kind} for Order Block ${ob.id} at index ${index}.`,
    refs: [
      {
        id: `${ob.id}-created`,
        kind:
          ob.direction === 'BULLISH'
            ? 'BULLISH_ORDER_BLOCK_CREATED'
            : 'BEARISH_ORDER_BLOCK_CREATED',
      },
    ],
    eventChain: ob.eventChain,
  }
}
