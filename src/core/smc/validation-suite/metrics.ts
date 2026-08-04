import type {
  SmcModuleAcceptanceStatus,
  SmcModuleValidationMetrics,
  SmcValidationModule,
} from './types'
import { SMC_ACCEPTANCE_GATES } from './types'

export function precisionRecall(
  truePositives: number,
  falsePositives: number,
  falseNegatives: number,
): { precision: number | null; recall: number | null } {
  const precisionDen = truePositives + falsePositives
  const recallDen = truePositives + falseNegatives
  return {
    precision: precisionDen > 0 ? truePositives / precisionDen : null,
    recall: recallDen > 0 ? truePositives / recallDen : null,
  }
}

export function reviewedAgreement(
  correct: number,
  wrong: number,
): number | null {
  const den = correct + wrong
  return den > 0 ? correct / den : null
}

/**
 * Assign acceptance status from reviewed-sample metrics only.
 * Never claims universal correctness — insufficient samples stay Experimental.
 */
export function acceptanceStatusForModule(input: {
  module: SmcValidationModule
  precision: number | null
  recall: number | null
  reviewedSampleCount: number
}): SmcModuleAcceptanceStatus {
  const gate = SMC_ACCEPTANCE_GATES[input.module]
  const samples = input.reviewedSampleCount
  if (samples <= 0 || input.precision == null) return 'Experimental'

  if (
    samples >= gate.minSamplesForVerified &&
    input.precision >= gate.verifiedPrecision &&
    (input.recall == null || input.recall >= gate.verifiedRecall)
  ) {
    return 'Verified'
  }

  if (samples >= gate.minSamplesForUsable && input.precision >= gate.usablePrecision) {
    return 'Usable'
  }

  if (samples > 0) return 'Needs Tuning'
  return 'Experimental'
}

export function buildModuleMetrics(input: {
  module: SmcValidationModule
  truePositives: number
  falsePositives: number
  falseNegatives: number
  reviewedCorrect: number
  reviewedWrong: number
  unsureCount: number
}): SmcModuleValidationMetrics {
  const { precision, recall } = precisionRecall(
    input.truePositives,
    input.falsePositives,
    input.falseNegatives,
  )
  const agreement = reviewedAgreement(input.reviewedCorrect, input.reviewedWrong)
  const reviewedSampleCount =
    input.reviewedCorrect + input.reviewedWrong + input.unsureCount

  return {
    module: input.module,
    truePositives: input.truePositives,
    falsePositives: input.falsePositives,
    falseNegatives: input.falseNegatives,
    precision,
    recall,
    reviewedAgreement: agreement,
    unsureCount: input.unsureCount,
    reviewedSampleCount,
    status: acceptanceStatusForModule({
      module: input.module,
      precision: precision ?? agreement,
      recall,
      reviewedSampleCount: input.reviewedCorrect + input.reviewedWrong,
    }),
  }
}

export const SMC_VALIDATION_MODULES: SmcValidationModule[] = [
  'Swing',
  'BOS',
  'CHoCH',
  'Displacement',
  'FVG',
  'Liquidity Sweep',
  'Order Block',
  'QML',
]
