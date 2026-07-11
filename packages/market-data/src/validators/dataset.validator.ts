import type { RawCandle, QualityIssue } from '../types/index.js'
import { TIMEFRAME_MINUTES as TF_MINUTES } from '../types/index.js'

export interface DatasetValidation {
  missingCandles: number
  duplicateCandles: number
  weekendGaps: number
  timezoneIssues: number
  issues: QualityIssue[]
}

export function validateDataset(
  candles: RawCandle[],
  timeframe: string,
  rejectedCount: number,
): DatasetValidation {
  const issues: QualityIssue[] = []
  let duplicateCandles = 0
  let weekendGaps = 0
  let missingCandles = 0

  const seen = new Set<string>()
  for (const c of candles) {
    if (seen.has(c.timestamp)) duplicateCandles++
    seen.add(c.timestamp)
  }

  if (duplicateCandles > 0) {
    issues.push({ type: 'duplicates', count: duplicateCandles, description: 'Duplicate timestamps in dataset' })
  }

  const minutes = TF_MINUTES[timeframe]
  if (minutes && candles.length > 1) {
    const sorted = [...candles].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    const expectedMs = minutes * 60 * 1000

    for (let i = 1; i < sorted.length; i++) {
      const gap = new Date(sorted[i].timestamp).getTime() - new Date(sorted[i - 1].timestamp).getTime()
      const day = new Date(sorted[i].timestamp).getUTCDay()

      if (gap > expectedMs * 1.5) {
        if (day === 0 || day === 6) {
          weekendGaps++
        } else {
          missingCandles++
        }
      }
    }
  }

  if (missingCandles > 0) {
    issues.push({ type: 'missing', count: missingCandles, description: 'Gaps detected in candle sequence' })
  }
  if (weekendGaps > 0) {
    issues.push({ type: 'weekend_gaps', count: weekendGaps, description: 'Weekend/holiday gaps (expected for forex)' })
  }
  if (rejectedCount > 0) {
    issues.push({ type: 'rejected', count: rejectedCount, description: 'Rows rejected during validation' })
  }

  return {
    missingCandles,
    duplicateCandles,
    weekendGaps,
    timezoneIssues: 0,
    issues,
  }
}

export function calculateQualityScore(
  totalRows: number,
  validRows: number,
  dataset: DatasetValidation,
  validationStats: { invalidOhlc: number; negativePrices: number; invalidTimestamp: number },
): number {
  if (totalRows === 0) return 0

  let score = 100

  const rejectionRate = (totalRows - validRows) / totalRows
  score -= rejectionRate * 40

  if (dataset.duplicateCandles > 0) score -= Math.min(15, dataset.duplicateCandles * 0.1)
  if (dataset.missingCandles > 0) score -= Math.min(20, dataset.missingCandles * 0.5)
  if (validationStats.invalidOhlc > 0) score -= Math.min(15, validationStats.invalidOhlc * 0.2)
  if (validationStats.negativePrices > 0) score -= 10

  return Math.max(0, Math.round(score * 10) / 10)
}
