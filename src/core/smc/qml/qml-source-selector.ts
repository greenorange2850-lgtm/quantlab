import type { Candle } from '@/data/candles'
import type { SmcChochEvent, SmcOrderBlockEvent, SmcSwingEvent } from '../types'
import type { SmcDowSwingMeta } from '../dow-theory/types'
import type { QmlConfig } from './qml-config'
import type {
  QmlDirection,
  QmlSourceSelection,
  QmlZoneMode,
} from './qml-types'

export interface QmlSourceSelectorInput {
  direction: QmlDirection
  sourceSwing: SmcSwingEvent | { id: string; candleIndex: number; price: number; timestamp: number }
  extremeSwing: SmcSwingEvent | { id: string; candleIndex: number; price: number; timestamp: number }
  choch: SmcChochEvent
  candles: readonly Candle[]
  visibleIndex: number
  dowMeta: SmcDowSwingMeta | null
  orderBlocks: readonly SmcOrderBlockEvent[]
  config: QmlConfig
}

export interface QmlZoneGeometry {
  zoneLow: number
  zoneHigh: number
  zoneMode: QmlZoneMode
  sourceCandleIndex: number | null
  sourceCandleTime: number | null
  linkedOrderBlockId: string | null
  selection: QmlSourceSelection
}

/**
 * Deterministic QML source selection.
 * Priority:
 * 1. Exact Dow-classified LH / HL broken by the CHoCH
 * 2. Source swing referenced by the CHoCH
 * 3. Last opposite candle associated with that structural leg
 * 4. Linked active Order Block, if configured
 * Never select an arbitrary nearby candle.
 */
export function selectQmlSource(input: QmlSourceSelectorInput): QmlZoneGeometry {
  const {
    direction,
    sourceSwing,
    extremeSwing,
    choch,
    candles,
    visibleIndex,
    dowMeta,
    orderBlocks,
    config,
  } = input

  const explanation: string[] = []
  const brokenId = choch.brokenSwingId
  const expectedLabel = direction === 'BULLISH' ? 'LH' : 'HL'

  // Priority 1: Dow-classified LH/HL that is broken by CHoCH
  if (dowMeta && dowMeta.label === expectedLabel && dowMeta.swingId === brokenId) {
    explanation.push(
      `Priority 1: Dow-classified ${expectedLabel} swing ${brokenId} is the CHoCH broken swing.`,
    )
    return buildFromSwing({
      method: 'DOW_CLASSIFIED_SWING',
      sourceSwing,
      extremeSwing,
      choch,
      candles,
      visibleIndex,
      direction,
      config,
      explanation,
      orderBlocks,
    })
  }

  // Priority 2: Source swing referenced by CHoCH
  if (sourceSwing.id === brokenId || brokenId.length > 0) {
    explanation.push(
      `Priority 2: CHoCH broken swing ${brokenId} used as QML source swing.`,
    )
    if (dowMeta?.label && dowMeta.label !== expectedLabel) {
      explanation.push(
        `Note: Dow label on source is ${dowMeta.label}, expected ${expectedLabel} for ${direction} QML.`,
      )
    }
    return buildFromSwing({
      method: 'CHOCH_BROKEN_SWING',
      sourceSwing: {
        id: brokenId || sourceSwing.id,
        candleIndex: choch.brokenSwingCandleIndex,
        price: choch.brokenSwingPrice,
        timestamp: choch.brokenSwingTimestamp,
      },
      extremeSwing,
      choch,
      candles,
      visibleIndex,
      direction,
      config,
      explanation,
      orderBlocks,
    })
  }

  explanation.push('No CHoCH broken swing id — falling back to structure level.')
  return structureLevelFallback(sourceSwing, explanation, config.zoneMode)
}

function buildFromSwing(args: {
  method: QmlSourceSelection['method']
  sourceSwing: { id: string; candleIndex: number; price: number; timestamp: number }
  extremeSwing: { id: string; candleIndex: number; price: number; timestamp: number }
  choch: SmcChochEvent
  candles: readonly Candle[]
  visibleIndex: number
  direction: QmlDirection
  config: QmlConfig
  explanation: string[]
  orderBlocks: readonly SmcOrderBlockEvent[]
}): QmlZoneGeometry {
  const {
    method,
    sourceSwing,
    extremeSwing,
    choch,
    candles,
    visibleIndex,
    direction,
    config,
    explanation,
    orderBlocks,
  } = args

  // Priority 4 (optional early): linked OB when configured
  if (config.zoneMode === 'LINKED_ORDER_BLOCK' || config.preferLinkedOrderBlock) {
    const linked = findLinkedOrderBlock(
      orderBlocks,
      direction,
      choch,
      sourceSwing,
      visibleIndex,
    )
    if (linked) {
      explanation.push(
        `Priority 4: Linked active Order Block ${linked.orderBlockId} used for zone.`,
      )
      return {
        zoneLow: linked.zoneLow,
        zoneHigh: linked.zoneHigh,
        zoneMode: 'LINKED_ORDER_BLOCK',
        sourceCandleIndex: linked.sourceCandleIndex,
        sourceCandleTime: linked.sourceCandleTimestamp,
        linkedOrderBlockId: linked.orderBlockId,
        selection: {
          method: 'LINKED_ORDER_BLOCK',
          sourceSwingId: sourceSwing.id,
          sourceCandleIndex: linked.sourceCandleIndex,
          sourceCandleTime: linked.sourceCandleTimestamp,
          linkedOrderBlockId: linked.orderBlockId,
          explanation: [...explanation],
        },
      }
    }
    if (config.zoneMode === 'LINKED_ORDER_BLOCK') {
      explanation.push(
        'LINKED_ORDER_BLOCK requested but no overlapping active OB — falling back to candle/structure.',
      )
    }
  }

  // Priority 3: last opposite candle of the structural leg
  const oppositeCandle = findOppositeCandleOfLeg(
    candles,
    direction,
    sourceSwing.candleIndex,
    extremeSwing.candleIndex,
    choch.candleIndex,
    visibleIndex,
  )

  if (oppositeCandle) {
    explanation.push(
      `Priority 3: Opposite ${direction === 'BULLISH' ? 'bearish' : 'bullish'} candle at index ${oppositeCandle.index} on structural leg.`,
    )
    const geometry = zoneFromCandle(
      oppositeCandle.candle,
      oppositeCandle.index,
      direction,
      config.zoneMode === 'LINKED_ORDER_BLOCK' ? 'OPEN_TO_EXTREME' : config.zoneMode,
    )
    if (geometry) {
      return {
        ...geometry,
        linkedOrderBlockId: null,
        selection: {
          method: method === 'DOW_CLASSIFIED_SWING' ? method : 'OPPOSITE_CANDLE_OF_LEG',
          sourceSwingId: sourceSwing.id,
          sourceCandleIndex: oppositeCandle.index,
          sourceCandleTime: oppositeCandle.candle.time,
          linkedOrderBlockId: null,
          explanation: [
            ...explanation,
            ...geometry.selection.explanation,
          ],
        },
      }
    }
  }

  explanation.push(
    'No valid candle source exists — STRUCTURE_LEVEL fallback with swing price as level.',
  )
  return structureLevelFallback(sourceSwing, explanation, 'STRUCTURE_LEVEL')
}

function zoneFromCandle(
  candle: Candle,
  index: number,
  direction: QmlDirection,
  zoneMode: QmlZoneMode,
): QmlZoneGeometry | null {
  const explanation: string[] = []
  let zoneLow: number
  let zoneHigh: number
  let resolvedMode = zoneMode

  if (zoneMode === 'STRUCTURE_LEVEL' || zoneMode === 'LINKED_ORDER_BLOCK') {
    return null
  }

  if (direction === 'BULLISH') {
    // Source bearish candle
    const isBearish = candle.close < candle.open
    if (!isBearish && zoneMode !== 'FULL_CANDLE') {
      explanation.push(
        'Source candle is not bearish; using FULL_CANDLE geometry from swing candle.',
      )
    }
    switch (zoneMode) {
      case 'FULL_CANDLE':
        zoneLow = candle.low
        zoneHigh = candle.high
        explanation.push('FULL_CANDLE: zone from candle low to high.')
        break
      case 'BODY':
        zoneLow = Math.min(candle.open, candle.close)
        zoneHigh = Math.max(candle.open, candle.close)
        explanation.push('BODY: zone from candle body.')
        break
      case 'OPEN_TO_EXTREME':
      default:
        zoneLow = candle.open
        zoneHigh = candle.high
        resolvedMode = 'OPEN_TO_EXTREME'
        explanation.push('OPEN_TO_EXTREME (bullish): zone from open to high.')
        break
    }
  } else {
    // Source bullish candle
    const isBullish = candle.close > candle.open
    if (!isBullish && zoneMode !== 'FULL_CANDLE') {
      explanation.push(
        'Source candle is not bullish; using FULL_CANDLE geometry from swing candle.',
      )
    }
    switch (zoneMode) {
      case 'FULL_CANDLE':
        zoneLow = candle.low
        zoneHigh = candle.high
        explanation.push('FULL_CANDLE: zone from candle low to high.')
        break
      case 'BODY':
        zoneLow = Math.min(candle.open, candle.close)
        zoneHigh = Math.max(candle.open, candle.close)
        explanation.push('BODY: zone from candle body.')
        break
      case 'OPEN_TO_EXTREME':
      default:
        zoneLow = candle.low
        zoneHigh = candle.open
        resolvedMode = 'OPEN_TO_EXTREME'
        explanation.push('OPEN_TO_EXTREME (bearish): zone from low to open.')
        break
    }
  }

  if (!(zoneHigh > zoneLow)) {
    return null
  }

  return {
    zoneLow,
    zoneHigh,
    zoneMode: resolvedMode,
    sourceCandleIndex: index,
    sourceCandleTime: candle.time,
    linkedOrderBlockId: null,
    selection: {
      method: 'OPPOSITE_CANDLE_OF_LEG',
      sourceSwingId: '',
      sourceCandleIndex: index,
      sourceCandleTime: candle.time,
      linkedOrderBlockId: null,
      explanation,
    },
  }
}

function structureLevelFallback(
  sourceSwing: { id: string; candleIndex: number; price: number; timestamp: number },
  explanation: string[],
  zoneMode: QmlZoneMode,
): QmlZoneGeometry {
  // Thin structural band around swing price (0.02% half-width minimum tick).
  const half = Math.max(sourceSwing.price * 0.0001, 1e-8)
  return {
    zoneLow: sourceSwing.price - half,
    zoneHigh: sourceSwing.price + half,
    zoneMode: 'STRUCTURE_LEVEL',
    sourceCandleIndex: sourceSwing.candleIndex,
    sourceCandleTime: sourceSwing.timestamp,
    linkedOrderBlockId: null,
    selection: {
      method: 'STRUCTURE_LEVEL_FALLBACK',
      sourceSwingId: sourceSwing.id,
      sourceCandleIndex: sourceSwing.candleIndex,
      sourceCandleTime: sourceSwing.timestamp,
      linkedOrderBlockId: null,
      explanation: [
        ...explanation,
        `STRUCTURE_LEVEL fallback at swing ${sourceSwing.id} price ${sourceSwing.price} (requested ${zoneMode}).`,
      ],
    },
  }
}

/**
 * Last opposite candle on the structural leg:
 * Bullish QML → last bearish candle at/near the LH before the LL and CHoCH.
 * Bearish QML → last bullish candle at/near the HL before the HH and CHoCH.
 */
function findOppositeCandleOfLeg(
  candles: readonly Candle[],
  direction: QmlDirection,
  sourceIndex: number,
  extremeIndex: number,
  chochIndex: number,
  visibleIndex: number,
): { index: number; candle: Candle } | null {
  const end = Math.min(sourceIndex, extremeIndex - 1, chochIndex - 1, visibleIndex)
  if (end < 0 || sourceIndex > visibleIndex) return null

  // Search from source swing candle backward a small window, then at the swing itself.
  const searchStart = Math.max(0, sourceIndex - 3)
  const searchEnd = Math.min(end, sourceIndex)

  // Prefer the swing candle itself when it matches polarity.
  const atSwing = candles[sourceIndex]
  if (atSwing && sourceIndex <= visibleIndex && sourceIndex < chochIndex) {
    const matches =
      direction === 'BULLISH' ? atSwing.close < atSwing.open : atSwing.close > atSwing.open
    if (matches) return { index: sourceIndex, candle: atSwing }
  }

  for (let i = searchEnd; i >= searchStart; i -= 1) {
    if (i >= chochIndex || i > visibleIndex) continue
    const c = candles[i]
    if (!c) continue
    const matches = direction === 'BULLISH' ? c.close < c.open : c.close > c.open
    if (matches) return { index: i, candle: c }
  }

  // Fall back to the swing candle even if polarity does not match (FULL_CANDLE can use it).
  if (atSwing && sourceIndex < chochIndex && sourceIndex <= visibleIndex) {
    return { index: sourceIndex, candle: atSwing }
  }
  return null
}

function findLinkedOrderBlock(
  orderBlocks: readonly SmcOrderBlockEvent[],
  direction: QmlDirection,
  choch: SmcChochEvent,
  sourceSwing: { id: string; price: number },
  visibleIndex: number,
): SmcOrderBlockEvent | null {
  const created = orderBlocks.filter(
    (e) =>
      e.candleIndex <= visibleIndex &&
      ((direction === 'BULLISH' && e.kind === 'BULLISH_ORDER_BLOCK_CREATED') ||
        (direction === 'BEARISH' && e.kind === 'BEARISH_ORDER_BLOCK_CREATED')) &&
      e.direction === direction,
  )

  // Prefer OB linked to the same CHoCH, else overlapping the source price.
  const linkedToChoch = created.find((e) => e.sourceBreakId === choch.id)
  if (linkedToChoch) {
    const invalidated = orderBlocks.some(
      (e) =>
        e.orderBlockId === linkedToChoch.orderBlockId &&
        e.kind === 'ORDER_BLOCK_INVALIDATED' &&
        e.candleIndex <= visibleIndex,
    )
    if (!invalidated) return linkedToChoch
  }

  for (let i = created.length - 1; i >= 0; i -= 1) {
    const ob = created[i]!
    const invalidated = orderBlocks.some(
      (e) =>
        e.orderBlockId === ob.orderBlockId &&
        e.kind === 'ORDER_BLOCK_INVALIDATED' &&
        e.candleIndex <= visibleIndex,
    )
    if (invalidated) continue
    if (sourceSwing.price >= ob.zoneLow && sourceSwing.price <= ob.zoneHigh) {
      return ob
    }
  }
  return null
}
