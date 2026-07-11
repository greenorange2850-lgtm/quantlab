import type { BacktestStatistics } from '../backtest/BacktestResult.js'
import type { Trade } from '../backtest/Trade.js'
import type { EnrichedEquityPoint } from './types.js'
import type { BacktestReport } from './types.js'

function escapeCsvValue(value: string | number): string {
  const text = String(value)
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replaceAll('"', '""')}"`
  }
  return text
}

function toCsvRow(values: Array<string | number>): string {
  return values.map(escapeCsvValue).join(',')
}

export function exportTradesCsv(trades: Trade[]): string {
  const header = toCsvRow([
    'id',
    'symbol',
    'entryTime',
    'exitTime',
    'entryPrice',
    'exitPrice',
    'quantity',
    'direction',
    'pnl',
    'commission',
    'duration',
  ])

  const rows = trades.map((trade) =>
    toCsvRow([
      trade.id,
      trade.symbol,
      trade.entryTime,
      trade.exitTime,
      trade.entryPrice,
      trade.exitPrice,
      trade.quantity,
      trade.direction,
      trade.pnl,
      trade.commission,
      trade.duration,
    ]),
  )

  return [header, ...rows].join('\n')
}

export function exportEquityCsv(curve: EnrichedEquityPoint[]): string {
  const header = toCsvRow(['time', 'equity', 'cash', 'drawdown'])
  const rows = curve.map((point) =>
    toCsvRow([point.time, point.equity, point.cash, point.drawdown]),
  )
  return [header, ...rows].join('\n')
}

export function exportStatisticsCsv(statistics: BacktestStatistics): string {
  const header = toCsvRow(['metric', 'value'])
  const rows = Object.entries(statistics).map(([metric, value]) => toCsvRow([metric, value]))
  return [header, ...rows].join('\n')
}

export function exportReportStatisticsCsv(report: BacktestReport): string {
  const header = toCsvRow(['metric', 'value'])
  const rows = Object.entries(report.summary).map(([metric, value]) => toCsvRow([metric, value]))
  return [header, ...rows].join('\n')
}
