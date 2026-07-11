import type { EnrichedEquityPoint, MonthlyReturn, MonthlyReturnsAnalysis } from './types.js'

function monthKey(time: number): string {
  const date = new Date(time)
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export function analyzeMonthlyReturns(
  curve: EnrichedEquityPoint[],
  initialCapital: number,
): MonthlyReturnsAnalysis {
  if (curve.length === 0) {
    return { months: [], bestMonth: null, worstMonth: null }
  }

  const grouped = new Map<string, EnrichedEquityPoint[]>()

  for (const point of curve) {
    const key = monthKey(point.time)
    const bucket = grouped.get(key)
    if (bucket) {
      bucket.push(point)
    } else {
      grouped.set(key, [point])
    }
  }

  const months: MonthlyReturn[] = []
  let previousEndEquity = initialCapital

  for (const [month, points] of [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const startEquity = points[0].equity
    const endEquity = points.at(-1)!.equity
    const monthlyReturn = startEquity > 0 ? (endEquity - startEquity) / startEquity : 0
    const cumulativeReturn = previousEndEquity > 0
      ? (endEquity - initialCapital) / initialCapital
      : 0

    months.push({
      month,
      startEquity,
      endEquity,
      monthlyReturn,
      cumulativeReturn,
    })

    previousEndEquity = endEquity
  }

  const bestMonth = months.reduce<MonthlyReturn | null>(
    (best, month) => (!best || month.monthlyReturn > best.monthlyReturn ? month : best),
    null,
  )
  const worstMonth = months.reduce<MonthlyReturn | null>(
    (worst, month) => (!worst || month.monthlyReturn < worst.monthlyReturn ? month : worst),
    null,
  )

  return { months, bestMonth, worstMonth }
}
