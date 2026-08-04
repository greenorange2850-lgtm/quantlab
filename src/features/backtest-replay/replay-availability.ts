import { getBacktestDetail } from '@/backtests/detail-archive'
import { canOpenReplayFromDetail } from './load-replay'

/**
 * Sync index of backtest ids known to have replay payloads (IndexedDB or
 * detail-archive candles+trades). Updated eagerly when Random Search / live
 * backtests persist replay so Open Replay enables without waiting on async IDB.
 */
const availableReplayIds = new Set<string>()

/** Mark a backtest as having openable replay data (candles + trades). */
export function markReplayAvailable(backtestId: string): void {
  if (!backtestId) return
  availableReplayIds.add(backtestId)
}

export function clearReplayAvailabilityIndex(): void {
  availableReplayIds.clear()
}

/** Test helper — inspect sync index. */
export function isReplayMarkedAvailable(backtestId: string): boolean {
  return availableReplayIds.has(backtestId)
}

/** Synchronous check — prefer marked ids, then local detail archive. */
export function isReplayAvailableForBacktest(backtestId: string | null | undefined): boolean {
  if (!backtestId) return false
  if (availableReplayIds.has(backtestId)) return true
  const detail = getBacktestDetail(backtestId)
  if (!detail) return false
  const available = canOpenReplayFromDetail({
    candles: detail.context.candles,
    trades: detail.report.trades,
  })
  if (available) availableReplayIds.add(backtestId)
  return available
}
