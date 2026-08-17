export {
  extractCandleFeatures,
  classifyCandleDirection,
  classifyPreviousBreak,
  calculateRetracementDepthIntoPrevious,
} from './feature-extractor.js'

export {
  detectDirectConsumptionSetups,
  DIRECT_CONSUMPTION_THRESHOLDS,
} from './direct-consumption.js'

export {
  listCandleResearchReviews,
  getCandleResearchReview,
  saveCandleResearchReview,
  clearCandleResearchReview,
  clearCandleResearchReviewStorageForTests,
} from './review-archive.js'

export type {
  CandleDirection,
  PreviousBreakClassification,
  PreviousCandleReference,
  CandleFeature,
  ResearchHypothesisId,
  DirectConsumptionReference,
  ResearchSetup,
  ResearchReviewVerdict,
  ResearchSetupReview,
} from './types.js'
