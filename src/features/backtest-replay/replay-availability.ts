import { getBacktestDetail } from '@/backtests/detail-archive'
import { canOpenReplayFromDetail } from './load-replay'

/** Synchronous check against the local detail archive (candles + trades). */
export function isReplayAvailableForBacktest(backtestId: string | null | undefined): boolean {
  if (!backtestId) return false
  const detail = getBacktestDetail(backtestId)
  if (!detail) return false
  return canOpenReplayFromDetail({
    candles: detail.context.candles,
    trades: detail.report.trades,
  })
}
