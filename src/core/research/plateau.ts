import type { PlateauReason, PlateauResult } from './types.js'
import { estimateSearchSpaceSize } from './neighborhood.js'
import type { ParameterRange } from './types.js'

export const DEFAULT_PLATEAU_UNIQUE_WINDOW = 40
export const DEFAULT_PLATEAU_EPSILON = 0.01
export const HIGH_DUPLICATE_RATE = 0.55

export function detectPlateau(input: {
  uniqueSinceImprovement: number
  plateauUniqueWindow: number
  recentBestScores: number[]
  plateauEpsilon: number
  duplicateRate: number
  uniqueCount: number
  parameterRanges: ParameterRange[]
  continued: boolean
}): PlateauResult {
  const {
    uniqueSinceImprovement,
    plateauUniqueWindow,
    recentBestScores,
    plateauEpsilon,
    duplicateRate,
    uniqueCount,
    parameterRanges,
    continued,
  } = input

  const space = estimateSearchSpaceSize(parameterRanges)
  const spaceExhausted = uniqueCount >= Math.floor(space * 0.92)

  if (spaceExhausted) {
    return {
      detected: true,
      reason: 'space_exhausted',
      detail: `Usable parameter space is nearly exhausted (${uniqueCount} unique of ~${space} estimated).`,
      continued,
      uniqueSinceImprovement,
    }
  }

  if (duplicateRate >= HIGH_DUPLICATE_RATE && uniqueSinceImprovement >= Math.floor(plateauUniqueWindow / 2)) {
    return {
      detected: true,
      reason: 'high_duplicate_rate',
      detail: `Duplicate rate ${(duplicateRate * 100).toFixed(0)}% is high while no meaningful improvement occurred.`,
      continued,
      uniqueSinceImprovement,
    }
  }

  if (uniqueSinceImprovement >= plateauUniqueWindow) {
    return {
      detected: true,
      reason: 'no_improvement_window',
      detail: `No meaningful best-score improvement for ${uniqueSinceImprovement} unique candidates (window ${plateauUniqueWindow}).`,
      continued,
      uniqueSinceImprovement,
    }
  }

  if (recentBestScores.length >= 5) {
    const first = recentBestScores[0]!
    const last = recentBestScores[recentBestScores.length - 1]!
    const denom = Math.max(Math.abs(first), 1e-9)
    const rel = Math.abs(last - first) / denom
    if (rel < plateauEpsilon && uniqueSinceImprovement >= Math.floor(plateauUniqueWindow / 2)) {
      return {
        detected: true,
        reason: 'epsilon_flat',
        detail: `Best score changed by less than ${(plateauEpsilon * 100).toFixed(1)}% over the recent window.`,
        continued,
        uniqueSinceImprovement,
      }
    }
  }

  return {
    detected: false,
    reason: 'none',
    detail: 'Search is still making progress or has not met plateau thresholds.',
    continued: true,
    uniqueSinceImprovement,
  }
}

export function plateauReasonLabel(reason: PlateauReason): string {
  switch (reason) {
    case 'no_improvement_window':
      return 'No improvement in configured window'
    case 'epsilon_flat':
      return 'Score flat within epsilon'
    case 'high_duplicate_rate':
      return 'High duplicate rate'
    case 'space_exhausted':
      return 'Parameter space nearly exhausted'
    case 'none':
      return 'None'
  }
}
