import type { QmlConfig } from './qml-config'
import type { QmlPattern, QmlScoreBreakdown } from './qml-types'

/**
 * QML setup strength 0–100 — relevance/quality, not win probability.
 * Store every scoring reason.
 */
export function scoreQmlPattern(
  pattern: Pick<
    QmlPattern,
    | 'priorTrend'
    | 'trendStrength'
    | 'structureScope'
    | 'status'
    | 'retestDetails'
    | 'confirmationRefs'
    | 'zoneHigh'
    | 'zoneLow'
    | 'createdIndex'
    | 'retestIndex'
    | 'explanation'
    | 'direction'
  >,
  context: {
    hasStrongDisplacement: boolean
    hasLiquiditySweep: boolean
    hasFvgOverlap: boolean
    hasObOverlap: boolean
    conflictingExternalStructure: boolean
    visibleIndex: number
    config: QmlConfig
  },
): QmlScoreBreakdown {
  const factors: QmlScoreBreakdown['factors'] = []

  const add = (id: string, label: string, delta: number, reason: string) => {
    factors.push({ id, label, delta, reason })
  }

  if (pattern.trendStrength >= 50) {
    add(
      'prior-trend-clear',
      'Prior trend clearly established',
      15,
      `Prior ${pattern.priorTrend} strength ${pattern.trendStrength}`,
    )
  } else {
    add(
      'prior-trend-weak',
      'Weak prior trend',
      -10,
      `Prior ${pattern.priorTrend} strength ${pattern.trendStrength} < 50`,
    )
  }

  if (pattern.structureScope === 'EXTERNAL') {
    add('external-structure', 'External structure used', 15, 'Source from external swings')
  } else {
    add('internal-only', 'Internal-only structure', -8, 'Source from internal swings only')
  }

  add('valid-extreme', 'Valid extreme LL / HH', 10, 'Structural extreme confirmed before shift')
  add('clear-choch', 'Clear opposing CHoCH', 15, 'Opposing structure shift confirmed')

  if (context.hasStrongDisplacement) {
    add('strong-displacement', 'Strong displacement', 10, 'Directional displacement present')
  }
  if (context.hasLiquiditySweep) {
    add(
      'liquidity-sweep',
      'Liquidity sweep before reversal',
      10,
      'Directional liquidity sweep near extreme',
    )
  }

  const age = Math.max(0, context.visibleIndex - pattern.createdIndex)
  if (age <= 20) {
    add('fresh-zone', 'Fresh QML zone', 10, `Zone age ${age} bars`)
  } else if (age > 60) {
    add('old-zone', 'Old zone', -5, `Zone age ${age} bars > 60`)
  }

  if (context.hasFvgOverlap) {
    add('fvg-overlap', 'FVG overlap', 5, 'Directional FVG overlaps QML zone')
  }
  if (context.hasObOverlap) {
    add('ob-overlap', 'Order Block overlap', 5, 'Active OB overlaps QML zone')
  }

  if (pattern.retestDetails) {
    if (pattern.retestDetails.touchCount === 1) {
      add('clean-retest', 'Clean first retest', 10, 'Single clean retest touch')
    } else if (pattern.retestDetails.touchCount > 1) {
      add(
        'multiple-touches',
        'Multiple prior touches',
        -10,
        `${pattern.retestDetails.touchCount} touches on zone`,
      )
    }
  }

  const zoneHeight = Math.abs(pattern.zoneHigh - pattern.zoneLow)
  const mid = (pattern.zoneHigh + pattern.zoneLow) / 2
  if (mid > 0 && zoneHeight / mid > 0.015) {
    add(
      'wide-zone',
      'Very wide zone',
      -8,
      `Zone height ${(zoneHeight / mid) * 100}% of mid > 1.5%`,
    )
  }

  if (context.conflictingExternalStructure) {
    add(
      'conflicting-structure',
      'Conflicting external structure',
      -15,
      'Later opposing external BOS conflicts with QML direction',
    )
  }

  const total = Math.max(
    0,
    Math.min(
      100,
      factors.reduce((sum, f) => sum + f.delta, 0),
    ),
  )

  return { total, factors }
}
