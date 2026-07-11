import type { BacktestResult } from '../backtest/BacktestResult.js'
import type { BacktestReport } from './types.js'

export function exportBacktestResultJson(result: BacktestResult): string {
  return JSON.stringify(result, null, 2)
}

export function exportBacktestReportJson(report: BacktestReport): string {
  return JSON.stringify(report, null, 2)
}
