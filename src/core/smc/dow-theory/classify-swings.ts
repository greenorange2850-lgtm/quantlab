import type { DowSwingLabel, DowTheoryClassifiedSwing, SmcDowSwingMeta } from './types'

function isHigh(kind: string): boolean {
  return kind.includes('HIGH')
}

/**
 * Assign HH/HL/LH/LL labels by comparing successive highs and successive lows.
 * Internals and externals are labeled independently within their own high/low series
 * so progressive structure remains deterministic. Trend inference weights externals.
 */
export function classifyDowSwingProgression(
  swings: readonly DowTheoryClassifiedSwing[],
  visibleThroughIndex: number,
): SmcDowSwingMeta[] {
  const knowable = swings
    .filter((s) => s.confirmedAtIndex <= visibleThroughIndex)
    .slice()
    .sort(
      (a, b) =>
        a.confirmedAtIndex - b.confirmedAtIndex ||
        a.candleIndex - b.candleIndex ||
        a.id.localeCompare(b.id),
    )

  const lastHighByLayer = new Map<'INTERNAL' | 'EXTERNAL', DowTheoryClassifiedSwing>()
  const lastLowByLayer = new Map<'INTERNAL' | 'EXTERNAL', DowTheoryClassifiedSwing>()
  const out: SmcDowSwingMeta[] = []

  for (const swing of knowable) {
    const layer = swing.classification
    const high = isHigh(swing.kind)
    let label: DowSwingLabel | null = null
    let reason: string

    if (high) {
      const prev = lastHighByLayer.get(layer)
      if (!prev) {
        reason = `Seed ${layer.toLowerCase()} swing high — no prior high to compare.`
      } else if (swing.price > prev.price) {
        label = 'HH'
        reason = `Higher high vs prior ${layer.toLowerCase()} high at ${prev.price}.`
      } else if (swing.price < prev.price) {
        label = 'LH'
        reason = `Lower high vs prior ${layer.toLowerCase()} high at ${prev.price}.`
      } else {
        // Equal within exact price — treat as LH (failure to make HH) for bearish bias neutrality.
        label = 'LH'
        reason = `Equal high vs prior ${layer.toLowerCase()} high — counted as LH.`
      }
      lastHighByLayer.set(layer, swing)
    } else {
      const prev = lastLowByLayer.get(layer)
      if (!prev) {
        reason = `Seed ${layer.toLowerCase()} swing low — no prior low to compare.`
      } else if (swing.price > prev.price) {
        label = 'HL'
        reason = `Higher low vs prior ${layer.toLowerCase()} low at ${prev.price}.`
      } else if (swing.price < prev.price) {
        label = 'LL'
        reason = `Lower low vs prior ${layer.toLowerCase()} low at ${prev.price}.`
      } else {
        label = 'LL'
        reason = `Equal low vs prior ${layer.toLowerCase()} low — counted as LL.`
      }
      lastLowByLayer.set(layer, swing)
    }

    out.push({
      swingId: swing.id,
      label,
      candleIndex: swing.candleIndex,
      confirmedAtIndex: swing.confirmedAtIndex,
      classification: layer,
      kind: high ? 'HIGH' : 'LOW',
      price: swing.price,
      reason,
    })
  }

  return out
}
