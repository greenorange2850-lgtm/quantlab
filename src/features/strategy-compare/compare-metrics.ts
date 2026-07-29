import type { BacktestReport } from '@/core/analytics/types'

export type CompareDirection = 'improved' | 'decreased' | 'unchanged'

export interface OverviewPair {
  label: string
  baseline: string
  optimized: string
}

export interface MetricCompareRow {
  label: string
  previous: string
  current: string
  difference: string
  direction: CompareDirection | 'unavailable'
  /** When false, lower values are improvements (e.g. drawdown). */
  higherIsBetter: boolean
}

function formatMoney(value: number): string {
  const sign = value >= 0 ? '+' : '-'
  return `${sign}$${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatPlainMoney(value: number): string {
  return `$${Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function roiPercent(report: BacktestReport): number {
  const capital = report.config.initialCapital
  if (capital <= 0) return 0
  return (report.summary.netProfit / capital) * 100
}

function directionHigher(previous: number, current: number, epsilon = 1e-9): CompareDirection {
  const delta = current - previous
  if (Math.abs(delta) <= epsilon) return 'unchanged'
  return delta > 0 ? 'improved' : 'decreased'
}

function directionLower(previous: number, current: number, epsilon = 1e-9): CompareDirection {
  const delta = current - previous
  if (Math.abs(delta) <= epsilon) return 'unchanged'
  return delta < 0 ? 'improved' : 'decreased'
}

function formatSigned(value: number, decimals = 2): string {
  const sign = value > 0 ? '+' : value < 0 ? '' : ''
  return `${sign}${value.toFixed(decimals)}`
}

function formatSignedPercent(value: number, decimals = 1): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

/** Side-by-side overview tiles — values read from existing BacktestReport fields. */
export function buildOverviewPairs(
  baseline: BacktestReport,
  optimized: BacktestReport,
): OverviewPair[] {
  return [
    {
      label: 'Initial Capital',
      baseline: formatPlainMoney(baseline.config.initialCapital),
      optimized: formatPlainMoney(optimized.config.initialCapital),
    },
    {
      label: 'Final Equity',
      baseline: formatPlainMoney(baseline.summary.finalBalance),
      optimized: formatPlainMoney(optimized.summary.finalBalance),
    },
    {
      label: 'Net Profit',
      baseline: formatMoney(baseline.summary.netProfit),
      optimized: formatMoney(optimized.summary.netProfit),
    },
    {
      label: 'ROI',
      baseline: formatSignedPercent(roiPercent(baseline)),
      optimized: formatSignedPercent(roiPercent(optimized)),
    },
    {
      label: 'Total Trades',
      baseline: String(baseline.summary.totalTrades),
      optimized: String(optimized.summary.totalTrades),
    },
  ]
}

/** Metric rows with previous/current/diff — no new analytics formulas. */
export function buildMetricCompareRows(
  baseline: BacktestReport,
  optimized: BacktestReport,
): MetricCompareRow[] {
  const pfPrev = baseline.summary.profitFactor
  const pfCurr = optimized.summary.profitFactor
  const ddPrev = baseline.summary.maxDrawdown
  const ddCurr = optimized.summary.maxDrawdown
  const wrPrev = baseline.summary.winRate
  const wrCurr = optimized.summary.winRate
  const avgPrev = baseline.statistics.averageTrade
  const avgCurr = optimized.statistics.averageTrade
  const expPrev = baseline.summary.expectancy
  const expCurr = optimized.summary.expectancy

  return [
    {
      label: 'Profit Factor',
      previous: pfPrev.toFixed(2),
      current: pfCurr.toFixed(2),
      difference: formatSigned(pfCurr - pfPrev),
      direction: directionHigher(pfPrev, pfCurr),
      higherIsBetter: true,
    },
    {
      label: 'Max Drawdown',
      previous: `${(ddPrev * 100).toFixed(1)}%`,
      current: `${(ddCurr * 100).toFixed(1)}%`,
      difference: formatSignedPercent((ddCurr - ddPrev) * 100),
      direction: directionLower(ddPrev, ddCurr),
      higherIsBetter: false,
    },
    {
      label: 'Win Rate',
      previous: `${(wrPrev * 100).toFixed(1)}%`,
      current: `${(wrCurr * 100).toFixed(1)}%`,
      difference: formatSignedPercent((wrCurr - wrPrev) * 100),
      direction: directionHigher(wrPrev, wrCurr),
      higherIsBetter: true,
    },
    {
      label: 'Sharpe Ratio',
      previous: 'Unavailable',
      current: 'Unavailable',
      difference: '—',
      direction: 'unavailable',
      higherIsBetter: true,
    },
    {
      label: 'Average Trade',
      previous: avgPrev.toFixed(2),
      current: avgCurr.toFixed(2),
      difference: formatSigned(avgCurr - avgPrev),
      direction: directionHigher(avgPrev, avgCurr),
      higherIsBetter: true,
    },
    {
      label: 'Expectancy',
      previous: expPrev.toFixed(2),
      current: expCurr.toFixed(2),
      difference: formatSigned(expCurr - expPrev),
      direction: directionHigher(expPrev, expCurr),
      higherIsBetter: true,
    },
  ]
}

/** Human-readable change bullets from existing comparison directions only. */
export interface WhatsChangedItem {
  text: string
  direction: CompareDirection
}

export function buildWhatsChangedItems(
  baseline: BacktestReport,
  optimized: BacktestReport,
): WhatsChangedItem[] {
  const items: WhatsChangedItem[] = []

  const push = (direction: CompareDirection, improved: string, decreased: string) => {
    if (direction === 'improved') items.push({ text: improved, direction })
    else if (direction === 'decreased') items.push({ text: decreased, direction })
  }

  push(
    directionHigher(baseline.summary.netProfit, optimized.summary.netProfit),
    'Net profit increased.',
    'Net profit decreased.',
  )
  push(
    directionLower(baseline.summary.maxDrawdown, optimized.summary.maxDrawdown),
    'Drawdown reduced.',
    'Drawdown increased.',
  )
  push(
    directionHigher(baseline.summary.winRate, optimized.summary.winRate),
    'Win rate improved.',
    'Win rate declined.',
  )
  push(
    directionHigher(baseline.summary.profitFactor, optimized.summary.profitFactor),
    'Profit factor improved.',
    'Profit factor declined.',
  )
  push(
    directionHigher(baseline.summary.totalTrades, optimized.summary.totalTrades),
    'Trade count increased.',
    'Trade count decreased.',
  )
  push(
    directionHigher(baseline.summary.expectancy, optimized.summary.expectancy),
    'Expectancy improved.',
    'Expectancy declined.',
  )

  if (items.length === 0) {
    items.push({
      text: 'No material differences across the compared report metrics.',
      direction: 'unchanged',
    })
  }

  return items
}

/** @deprecated Prefer buildWhatsChangedItems — kept for simple string lists. */
export function buildWhatsChangedLines(
  baseline: BacktestReport,
  optimized: BacktestReport,
): string[] {
  return buildWhatsChangedItems(baseline, optimized).map((item) => item.text)
}

export function directionLabel(direction: CompareDirection | 'unavailable'): string {
  switch (direction) {
    case 'improved':
      return '↑ Improved'
    case 'decreased':
      return '↓ Decreased'
    case 'unchanged':
      return '→ No Change'
    case 'unavailable':
      return '—'
  }
}

export function buildImprovementHeadline(
  baseline: BacktestReport,
  optimized: BacktestReport,
): string {
  const netDir = directionHigher(baseline.summary.netProfit, optimized.summary.netProfit)
  const ddDir = directionLower(baseline.summary.maxDrawdown, optimized.summary.maxDrawdown)
  const pfDir = directionHigher(baseline.summary.profitFactor, optimized.summary.profitFactor)

  const improved = [netDir, ddDir, pfDir].filter((item) => item === 'improved').length
  const decreased = [netDir, ddDir, pfDir].filter((item) => item === 'decreased').length

  if (improved > decreased) {
    return 'Optimized candidate looks stronger on key historical metrics than the baseline.'
  }
  if (decreased > improved) {
    return 'Optimized candidate underperforms the baseline on key historical metrics.'
  }
  return 'Historical metrics are mixed versus the baseline — review differences carefully.'
}
