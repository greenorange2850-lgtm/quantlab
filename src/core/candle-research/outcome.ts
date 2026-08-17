import type { Candle } from '@/data/candles'
import { intervalToMs } from '@/data/research-period'
import { atr } from '@/core/indicators/atr'
import type {
  DirectConsumptionPenetrationThreshold,
  OutcomeAggregateStats,
  OutcomeWindowMetrics,
  ResearchSetup,
  SetupOutcome,
  SetupOutcomeMetrics,
} from './types'

const RECOVERY_LEVELS = [0.25, 0.5, 0.75, 1] as const
const WINDOW_DEFINITIONS = [
  { label: '+15m' as const, offsetMs: 15 * 60_000 },
  { label: '+30m' as const, offsetMs: 30 * 60_000 },
  { label: '+1h' as const, offsetMs: 60 * 60_000 },
  { label: '+2h' as const, offsetMs: 2 * 60 * 60_000 },
]

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2
  }
  return sorted[mid]!
}

function inferStepMs(candles: readonly Candle[], fallbackInterval?: string): number {
  if (candles.length >= 2) {
    const diffs: number[] = []
    for (let i = 1; i < candles.length; i++) {
      const diff = candles[i]!.time - candles[i - 1]!.time
      if (diff > 0) diffs.push(diff)
    }
    if (diffs.length > 0) return median(diffs) ?? diffs[0]!
  }
  return fallbackInterval ? intervalToMs(fallbackInterval) : 60_000
}

function createWindow(
  label: OutcomeWindowMetrics['label'],
  endTime: number,
  entryPrice: number,
  direction: 'up' | 'down',
  referenceRange: number,
  candles: readonly Candle[],
): OutcomeWindowMetrics {
  let mfePrice = 0
  let maePrice = 0

  for (const candle of candles) {
    if (direction === 'up') {
      mfePrice = Math.max(mfePrice, candle.high - entryPrice)
      maePrice = Math.max(maePrice, entryPrice - candle.low)
    } else {
      mfePrice = Math.max(mfePrice, entryPrice - candle.low)
      maePrice = Math.max(maePrice, candle.high - entryPrice)
    }
  }

  return {
    label,
    endTime,
    candleCount: candles.length,
    mfePrice,
    maePrice,
    recoveryPercent: referenceRange > 0 ? (mfePrice / referenceRange) * 100 : null,
  }
}

function firstRecoveryTimeMs(
  candles: readonly Candle[],
  entryPrice: number,
  direction: 'up' | 'down',
  referenceRange: number,
  setupTime: number,
  ratio: number,
): number | null {
  if (referenceRange <= 0) return null
  const target = referenceRange * ratio
  const hit = candles.find((candle) =>
    direction === 'up'
      ? candle.high - entryPrice >= target
      : entryPrice - candle.low >= target,
  )
  return hit ? Math.max(0, hit.time - setupTime) : null
}

function parentCandleColor(candle: Candle | null): 'bullish' | 'bearish' | 'neutral' | null {
  if (!candle) return null
  if (candle.close > candle.open) return 'bullish'
  if (candle.close < candle.open) return 'bearish'
  return 'neutral'
}

export function measureSetupOutcome(input: {
  candles: readonly Candle[]
  setup: ResearchSetup
  interval?: string
  atrPeriod?: number
}): SetupOutcomeMetrics {
  const { candles, setup } = input
  const atrPeriod = input.atrPeriod ?? 14
  const setupCandle = candles[setup.setupIndex]
  const futureCandles = setupCandle ? candles.slice(setup.setupIndex + 1) : []
  const referenceRange = setup.referenceCandle.high - setup.referenceCandle.low
  const entryPrice = setup.setupPrice
  const setupTime = setup.setupTime

  let mfePrice = 0
  let maePrice = 0
  let mfeTime: number | null = null

  for (const candle of futureCandles) {
    const favorable =
      setup.measurementDirection === 'up'
        ? candle.high - entryPrice
        : entryPrice - candle.low
    const adverse =
      setup.measurementDirection === 'up'
        ? entryPrice - candle.low
        : candle.high - entryPrice

    if (favorable > mfePrice) {
      mfePrice = favorable
      mfeTime = candle.time
    }
    maePrice = Math.max(maePrice, adverse)
  }

  const windows = WINDOW_DEFINITIONS.map(({ label, offsetMs }) => {
    const endTime = setupTime + offsetMs
    const sliced = futureCandles.filter((c) => c.time <= endTime)
    return createWindow(
      label,
      sliced.at(-1)?.time ?? null,
      entryPrice,
      setup.measurementDirection,
      referenceRange,
      sliced,
    )
  })

  const stepMs = inferStepMs(candles, input.interval)
  const parentEndTime = setupTime + stepMs * 4
  const parentSlice = futureCandles.filter((c) => c.time <= parentEndTime)
  const parentCloseCandle = parentSlice.at(-1) ?? null
  windows.push(
    createWindow(
      'parent_close',
      parentCloseCandle?.time ?? null,
      entryPrice,
      setup.measurementDirection,
      referenceRange,
      parentSlice,
    ),
  )

  const atrValue = atr(candles, atrPeriod, setup.setupIndex)

  return {
    setupId: setup.id,
    virtualEntry: {
      time: setup.setupTime,
      price: setup.setupPrice,
      referenceIndex: setup.referenceIndex,
      referenceTime: setup.referenceTime,
      referenceDirection: setup.referenceDirection,
      measurementDirection: setup.measurementDirection,
    },
    reference: {
      high: setup.referenceCandle.high,
      low: setup.referenceCandle.low,
      open: setup.referenceCandle.open,
      close: setup.referenceCandle.close,
      range: referenceRange,
    },
    windows,
    mfePrice,
    maePrice,
    mfePercentOfRange: referenceRange > 0 ? (mfePrice / referenceRange) * 100 : null,
    maePercentOfRange: referenceRange > 0 ? (maePrice / referenceRange) * 100 : null,
    mfeAtrNormalized: atrValue > 0 ? mfePrice / atrValue : null,
    maeAtrNormalized: atrValue > 0 ? maePrice / atrValue : null,
    maxRecoveryPercent: referenceRange > 0 ? (mfePrice / referenceRange) * 100 : null,
    timeToMfeMs: mfeTime != null ? Math.max(0, mfeTime - setupTime) : null,
    timeToRecoveryMs: {
      '0.25': firstRecoveryTimeMs(
        futureCandles,
        entryPrice,
        setup.measurementDirection,
        referenceRange,
        setupTime,
        0.25,
      ),
      '0.50': firstRecoveryTimeMs(
        futureCandles,
        entryPrice,
        setup.measurementDirection,
        referenceRange,
        setupTime,
        0.5,
      ),
      '0.75': firstRecoveryTimeMs(
        futureCandles,
        entryPrice,
        setup.measurementDirection,
        referenceRange,
        setupTime,
        0.75,
      ),
      '1.00': firstRecoveryTimeMs(
        futureCandles,
        entryPrice,
        setup.measurementDirection,
        referenceRange,
        setupTime,
        1,
      ),
    },
    previousHighRetested: futureCandles.some((candle) => candle.high >= setup.referenceCandle.high),
    previousLowRetested: futureCandles.some((candle) => candle.low <= setup.referenceCandle.low),
    oppositeExtremeBroken:
      setup.measurementDirection === 'up'
        ? futureCandles.some((candle) => candle.low < setup.referenceCandle.low)
        : futureCandles.some((candle) => candle.high > setup.referenceCandle.high),
    parentCandleFinalColor: parentCandleColor(parentCloseCandle),
  }
}

export function measureSetupOutcomes(input: {
  candles: readonly Candle[]
  setups: readonly ResearchSetup[]
  interval?: string
  atrPeriod?: number
}): SetupOutcome[] {
  return input.setups.map((setup) => ({
    setup,
    metrics: measureSetupOutcome({
      candles: input.candles,
      setup,
      interval: input.interval,
      atrPeriod: input.atrPeriod,
    }),
  }))
}

function percentageReached(value: number, total: number): number {
  if (total <= 0) return 0
  return (value / total) * 100
}

function collectRecoveryTimes(outcomes: readonly SetupOutcome[], level: keyof SetupOutcomeMetrics['timeToRecoveryMs']): number[] {
  return outcomes
    .map((item) => item.metrics.timeToRecoveryMs[level])
    .filter((value): value is number => value != null)
}

function buildAggregateForSet(outcomes: readonly SetupOutcome[]) {
  const total = outcomes.length
  const reached025 = collectRecoveryTimes(outcomes, '0.25').length
  const reached050 = collectRecoveryTimes(outcomes, '0.50').length
  const reached075 = collectRecoveryTimes(outcomes, '0.75').length
  const reached100 = collectRecoveryTimes(outcomes, '1.00').length

  return {
    totalSetups: total,
    medianMfePrice: median(outcomes.map((item) => item.metrics.mfePrice)),
    medianMaePrice: median(outcomes.map((item) => item.metrics.maePrice)),
    medianRecoveryTimeMs: median(collectRecoveryTimes(outcomes, '0.50')),
    reached: {
      '0.25': percentageReached(reached025, total),
      '0.50': percentageReached(reached050, total),
      '0.75': percentageReached(reached075, total),
      '1.00': percentageReached(reached100, total),
    },
  }
}

export function aggregateOutcomeStats(outcomes: readonly SetupOutcome[]): OutcomeAggregateStats {
  const all = buildAggregateForSet(outcomes)
  const thresholds: readonly DirectConsumptionPenetrationThreshold[] = [40, 50, 60, 70, 80]

  return {
    ...all,
    byPenetrationThreshold: thresholds.map((threshold) => {
      const group = outcomes.filter((item) => item.setup.penetrationThreshold === threshold)
      const aggregate = buildAggregateForSet(group)
      return {
        threshold,
        ...aggregate,
      }
    }),
  }
}
