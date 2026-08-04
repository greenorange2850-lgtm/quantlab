import type { AdaptiveStageBudget, OptimizationStageId } from './types.js'
import { DEFAULT_STAGE_BUDGET } from './types.js'

export interface ResolvedStageBudgets {
  exploration: number
  refinement: number
  stability: number
  total: number
}

/**
 * Allocate integer candidate budgets from ratios.
 * Exploration gets remainder so totals always equal `iterations`.
 */
export function resolveStageBudgets(
  iterations: number,
  budget: AdaptiveStageBudget = DEFAULT_STAGE_BUDGET,
): ResolvedStageBudgets {
  const total = Math.max(0, Math.floor(iterations))
  if (total === 0) {
    return { exploration: 0, refinement: 0, stability: 0, total: 0 }
  }

  const refinement = Math.floor(total * budget.refinementRatio)
  const stability = Math.floor(total * budget.stabilityRatio)
  const exploration = Math.max(0, total - refinement - stability)

  return { exploration, refinement, stability, total }
}

export function emptyStageProgress(budgets: ResolvedStageBudgets) {
  return {
    baseline: { completed: false },
    exploration: { done: 0, total: budgets.exploration },
    refinement: { done: 0, total: budgets.refinement },
    stability: { done: 0, total: budgets.stability },
  }
}

export function stageFromLiveStatus(
  status: string,
): OptimizationStageId | null {
  switch (status) {
    case 'BASELINE':
      return 'baseline'
    case 'EXPLORING':
    case 'IMPROVING':
    case 'PLATEAUING':
      return 'exploration'
    case 'REFINING':
      return 'refinement'
    case 'STABILITY_CHECK':
    case 'CONVERGED':
      return 'stability'
    default:
      return null
  }
}
