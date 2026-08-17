import type { Candle } from '@/data/candles'

export type CandleDirection = 'BULLISH' | 'BEARISH' | 'DOJI'

export type PreviousBreakClassification = 'HIGH_ONLY' | 'LOW_ONLY' | 'BOTH' | 'NEITHER'

export interface PreviousCandleReference {
  index: number
  time: number
  open: number
  high: number
  low: number
  close: number
  direction: CandleDirection
}

export interface CandleFeature {
  index: number
  candle: Candle
  direction: CandleDirection
  bullish: boolean
  bearish: boolean
  bodySize: number
  fullRange: number
  upperWick: number
  lowerWick: number
  bodyRangeRatio: number
  upperWickRangeRatio: number
  lowerWickRangeRatio: number
  previous: PreviousCandleReference | null
  brokePreviousHigh: boolean
  brokePreviousLow: boolean
  previousBreakClassification: PreviousBreakClassification
  /** 0..1 depth into previous candle body, oriented by previous candle direction. */
  retracementDepthIntoPrevious: number | null
}

export type ResearchHypothesisId = 'DIRECT_CONSUMPTION'

export type DirectConsumptionReference = 'BULLISH_REFERENCE' | 'BEARISH_REFERENCE'

export interface ResearchSetup {
  id: string
  hypothesis: ResearchHypothesisId
  candleIndex: number
  candleTime: number
  referenceCandleIndex: number
  referenceCandleTime: number
  referenceType: DirectConsumptionReference
  penetrationDepth: number
  penetrationThresholdsHit: number[]
}

export type ResearchReviewVerdict = 'correct' | 'wrong' | 'unclear'

export interface ResearchSetupReview {
  backtestId: string
  setupId: string
  hypothesis: ResearchHypothesisId
  verdict: ResearchReviewVerdict
  reviewedAt: number
}
