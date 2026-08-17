import type { Candle } from '@/data/candles'

export type CandleBreakClassification = 'HIGH_ONLY' | 'LOW_ONLY' | 'BOTH' | 'NEITHER'

export interface CandleFeature {
  index: number
  candle: Candle
  previousCandle: Candle | null
  bullish: boolean
  bearish: boolean
  bodySize: number
  fullRange: number
  upperWick: number
  lowerWick: number
  bodyToRangeRatio: number
  upperWickToRangeRatio: number
  lowerWickToRangeRatio: number
  brokePreviousHigh: boolean
  brokePreviousLow: boolean
  breakClassification: CandleBreakClassification
  retracementDepthIntoPreviousCandle: number | null
}

export type DirectConsumptionPenetrationThreshold = 40 | 50 | 60 | 70 | 80
export const DIRECT_CONSUMPTION_THRESHOLDS: readonly DirectConsumptionPenetrationThreshold[] = [
  40, 50, 60, 70, 80,
]

export type ResearchSetupDirection = 'bullish-reference' | 'bearish-reference'
export type OutcomeMeasurementDirection = 'up' | 'down'

export interface ResearchSetup {
  id: string
  kind: 'direct-consumption'
  setupIndex: number
  setupTime: number
  setupPrice: number
  referenceIndex: number
  referenceTime: number
  referenceCandle: Candle
  triggerCandle: Candle
  referenceDirection: ResearchSetupDirection
  measurementDirection: OutcomeMeasurementDirection
  penetrationThreshold: DirectConsumptionPenetrationThreshold
  penetrationRatio: number
  penetrationPercent: number
}

export interface OutcomeWindowMetrics {
  label: '+15m' | '+30m' | '+1h' | '+2h' | 'parent_close'
  endTime: number | null
  candleCount: number
  mfePrice: number
  maePrice: number
  recoveryPercent: number | null
}

export interface SetupOutcomeMetrics {
  setupId: string
  virtualEntry: {
    time: number
    price: number
    referenceIndex: number
    referenceTime: number
    referenceDirection: ResearchSetupDirection
    measurementDirection: OutcomeMeasurementDirection
  }
  reference: {
    high: number
    low: number
    open: number
    close: number
    range: number
  }
  windows: OutcomeWindowMetrics[]
  mfePrice: number
  maePrice: number
  mfePercentOfRange: number | null
  maePercentOfRange: number | null
  mfeAtrNormalized: number | null
  maeAtrNormalized: number | null
  maxRecoveryPercent: number | null
  timeToMfeMs: number | null
  timeToRecoveryMs: {
    '0.25': number | null
    '0.50': number | null
    '0.75': number | null
    '1.00': number | null
  }
  previousHighRetested: boolean
  previousLowRetested: boolean
  oppositeExtremeBroken: boolean
  parentCandleFinalColor: 'bullish' | 'bearish' | 'neutral' | null
}

export interface SetupOutcome {
  setup: ResearchSetup
  metrics: SetupOutcomeMetrics
}

export interface PenetrationThresholdAggregate {
  threshold: DirectConsumptionPenetrationThreshold
  totalSetups: number
  medianMfePrice: number | null
  medianMaePrice: number | null
  medianRecoveryTimeMs: number | null
  reached: {
    '0.25': number
    '0.50': number
    '0.75': number
    '1.00': number
  }
}

export interface OutcomeAggregateStats {
  totalSetups: number
  medianMfePrice: number | null
  medianMaePrice: number | null
  medianRecoveryTimeMs: number | null
  reached: {
    '0.25': number
    '0.50': number
    '0.75': number
    '1.00': number
  }
  byPenetrationThreshold: PenetrationThresholdAggregate[]
}

export type ManualReviewVerdict = 'correct' | 'wrong' | 'unclear'

export interface CandleResearchManualReview {
  setupId: string
  verdict: ManualReviewVerdict
  note: string
  updatedAt: number
}
