import { History, X, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { backtestDetailKeys } from '@/api/queries/backtest-details'
import { researchSessionKeys } from '@/api/queries/research-sessions'
import { formatRestoredDateRange } from '@/backtests/restore-dashboard'
import { useBacktestStore } from '@/stores/backtest.store'

export function RestoredBacktestBanner() {
  const queryClient = useQueryClient()
  const viewMode = useBacktestStore((state) => state.viewMode)
  const restoredId = useBacktestStore((state) => state.restoredId)
  const report = useBacktestStore((state) => state.report)
  const dashboard = useBacktestStore((state) => state.dashboard)
  const isRestoring = useBacktestStore((state) => state.isRestoring)
  const restoreError = useBacktestStore((state) => state.restoreError)
  const autoRestored = useBacktestStore((state) => state.autoRestored)
  const sessionHydrateError = useBacktestStore((state) => state.sessionHydrateError)
  const isHydratingSession = useBacktestStore((state) => state.isHydratingSession)
  const clearRestoredResult = useBacktestStore((state) => state.clearRestoredResult)
  const clearRestoreError = useBacktestStore((state) => state.clearRestoreError)
  const clearSessionHydrateError = useBacktestStore((state) => state.clearSessionHydrateError)
  const dismissAutoRestoredBadge = useBacktestStore((state) => state.dismissAutoRestoredBadge)
  const restoreBacktest = useBacktestStore((state) => state.restoreBacktest)
  const markSessionHydrateIdle = useBacktestStore((state) => state.markSessionHydrateIdle)

  const retrySessionHydrate = () => {
    clearSessionHydrateError()
    useBacktestStore.setState({ hasAttemptedSessionHydrate: false })
    markSessionHydrateIdle()
    void queryClient.invalidateQueries({ queryKey: backtestDetailKeys.latest() })
    void queryClient.invalidateQueries({ queryKey: researchSessionKeys.latest() })
  }

  if (isHydratingSession || isRestoring) {
    return (
      <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-white/[0.03] px-4 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" />
        {isHydratingSession ? 'Restoring previous session…' : 'Loading historical backtest…'}
      </div>
    )
  }

  if (sessionHydrateError) {
    return (
      <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2 text-xs text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="text-pretty">{sessionHydrateError}</span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-11 w-full sm:min-h-8 sm:w-auto"
            onClick={retrySessionHydrate}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Retry
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 w-full sm:min-h-8 sm:w-auto"
            onClick={clearSessionHydrateError}
          >
            Dismiss
          </Button>
        </div>
      </div>
    )
  }

  if (restoreError) {
    return (
      <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2 text-xs text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="text-pretty">{restoreError}</span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {restoredId ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="min-h-11 w-full sm:min-h-8 sm:w-auto"
              onClick={() => void restoreBacktest(restoredId)}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Retry
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 w-full sm:min-h-8 sm:w-auto"
            onClick={clearRestoreError}
          >
            Dismiss
          </Button>
        </div>
      </div>
    )
  }

  if (viewMode === 'restored' && report) {
    const dateRange = formatRestoredDateRange(report)
    const strategy = dashboard.activeStrategy

    return (
      <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-accent/25 bg-accent/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15">
            <History className="h-4 w-4 text-accent" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">Historical result loaded</p>
              <Badge variant="accent" className="text-[10px]">
                Read-only restore
              </Badge>
            </div>
            <p className="text-pretty text-xs text-muted-foreground">
              {strategy.name} · {strategy.version}
              {' · '}
              <span className="font-mono">{report.config.symbol}</span>
              {' · '}
              {dashboard.timeframeDistribution[0]?.name ??
                dashboard.recentBacktests.find((item) => item.id === restoredId)?.timeframe ??
                '—'}
              {dateRange ? ` · ${dateRange}` : null}
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="min-h-11 w-full shrink-0 sm:min-h-8 sm:w-auto"
          onClick={clearRestoredResult}
        >
          <X className="mr-1.5 h-3.5 w-3.5" />
          Back to latest session
        </Button>
      </div>
    )
  }

  if (autoRestored && report) {
    return (
      <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border border-border bg-white/[0.03] px-4 py-3">
        <Badge variant="accent" className="text-[10px]">
          Restored previous session
        </Badge>
        <p className="text-pretty text-xs text-muted-foreground">
          <span className="font-mono text-foreground">{report.config.symbol}</span>
          {' · '}
          {dashboard.activeStrategy.name}
          {' · '}
          dashboard survived refresh — no backtest rerun
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto min-h-9 sm:min-h-8"
          onClick={dismissAutoRestoredBadge}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    )
  }

  return null
}
