import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FlaskConical, Play, Loader2, AlertCircle, RefreshCw, Sparkles } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Disclosure } from '@/components/ui/disclosure'
import { SymbolSelect } from '@/components/market/SymbolSelect'
import { TimeframeSelect } from '@/components/market/TimeframeSelect'
import { useBinanceKlines } from '@/api/queries/binance-market'
import { defaultBacktestPipelineParams } from '@/core/dashboard'
import { DEFAULT_MA_CROSS_PARAMS, type MovingAverageCrossParams } from '@/core/strategy'
import { useBacktestStore } from '@/stores/backtest.store'
import { useResearchStore } from '@/stores/research.store'
import type { BacktestTimeframe } from '@/data/binance-exchange-info'

interface BacktestSetupFormProps {
  title: string
  description: string
  /** Optional heading icon wrapper class differentiation */
  variant?: 'strategy' | 'backtest'
}

export function BacktestSetupForm({ title, description }: BacktestSetupFormProps) {
  const navigate = useNavigate()
  const runBacktest = useBacktestStore((state) => state.runBacktest)
  const isRunning = useBacktestStore((state) => state.isRunning)
  const error = useBacktestStore((state) => state.error)
  const hasBacktest = useBacktestStore((state) => state.dashboard.hasBacktest)
  const appliedParameters = useResearchStore((state) => state.appliedParameters)
  const clearAppliedParameters = useResearchStore((state) => state.clearAppliedParameters)

  const [symbol, setSymbol] = useState(defaultBacktestPipelineParams.symbol)
  const [interval, setInterval] = useState<BacktestTimeframe>(
    defaultBacktestPipelineParams.interval as BacktestTimeframe,
  )
  const [limit, setLimit] = useState(String(defaultBacktestPipelineParams.limit))
  const [initialCapital, setInitialCapital] = useState(
    String(defaultBacktestPipelineParams.initialCapital),
  )
  const [strategyParams, setStrategyParams] = useState<MovingAverageCrossParams>({
    ...DEFAULT_MA_CROSS_PARAMS,
  })
  const [appliedNotice, setAppliedNotice] = useState(false)

  useEffect(() => {
    if (!appliedParameters) return
    setStrategyParams({ ...appliedParameters })
    setAppliedNotice(true)
    clearAppliedParameters()
  }, [appliedParameters, clearAppliedParameters])

  const parsedLimit = useMemo(() => {
    const value = Number(limit)
    return Number.isFinite(value) && value >= 1
      ? Math.min(Math.floor(value), 1000)
      : defaultBacktestPipelineParams.limit
  }, [limit])

  const candlesQuery = useBinanceKlines(symbol, interval, parsedLimit)

  const candlesLoading = candlesQuery.isLoading || candlesQuery.isFetching
  const candlesError = candlesQuery.isError
  const candlesReady = Boolean(candlesQuery.data && candlesQuery.data.length > 0)

  const canRun = candlesReady && !candlesLoading && !isRunning

  const updateParam = (key: keyof MovingAverageCrossParams, raw: string) => {
    const value = Number(raw)
    if (!Number.isFinite(value)) return
    setStrategyParams((current) => ({ ...current, [key]: Math.round(value) }))
    setAppliedNotice(false)
  }

  const handleRunBacktest = async () => {
    if (!candlesQuery.data?.length) return

    const parsedCapital = Number(initialCapital)

    await runBacktest({
      symbol,
      interval,
      limit: parsedLimit,
      initialCapital: Number.isFinite(parsedCapital)
        ? parsedCapital
        : defaultBacktestPipelineParams.initialCapital,
      candles: candlesQuery.data,
      strategyParams,
    })

    if (!useBacktestStore.getState().error) {
      navigate('/')
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl min-w-0 space-y-6">
      <div className="flex min-w-0 items-start gap-3 sm:items-center">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/20 bg-accent/15">
          <FlaskConical className="h-5 w-5 text-accent" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="text-pretty text-xs text-muted-foreground">{description}</p>
        </div>
      </div>

      <Card glow>
        <CardHeader>
          <CardTitle className="text-base">Run Backtest</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4">
          <p className="text-pretty text-[11px] text-muted-foreground">
            Evaluates the current parameters once.
          </p>

          {appliedNotice && (
            <div className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-accent">
              Parameters applied from Random Search. Review and run when ready.
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Strategy
              </label>
              <Input value="Moving Average Cross" disabled className="w-full bg-white/[0.03]" />
            </div>

            <div className="min-w-0 space-y-2">
              <label
                htmlFor="backtest-symbol"
                className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
              >
                Market pair
              </label>
              <SymbolSelect id="backtest-symbol" value={symbol} onChange={setSymbol} />
            </div>

            <div className="min-w-0 space-y-2">
              <label
                htmlFor="backtest-timeframe"
                className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
              >
                Timeframe
              </label>
              <TimeframeSelect
                id="backtest-timeframe"
                value={interval}
                onChange={setInterval}
              />
            </div>

            <div className="min-w-0 space-y-2">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Candle Limit
              </label>
              <Input
                value={limit}
                onChange={(event) => setLimit(event.target.value)}
                inputMode="numeric"
                className="w-full bg-white/[0.03]"
              />
            </div>

            <div className="min-w-0 space-y-2 md:col-span-2">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Initial Capital
              </label>
              <Input
                value={initialCapital}
                onChange={(event) => setInitialCapital(event.target.value)}
                inputMode="decimal"
                className="w-full bg-white/[0.03] md:max-w-xs"
              />
            </div>
          </div>

          <Disclosure title="Strategy parameters">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="min-w-0 space-y-2">
                <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Fast EMA
                </label>
                <Input
                  value={String(strategyParams.fastPeriod)}
                  onChange={(event) => updateParam('fastPeriod', event.target.value)}
                  inputMode="numeric"
                  className="w-full bg-white/[0.03]"
                />
              </div>
              <div className="min-w-0 space-y-2">
                <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Slow EMA
                </label>
                <Input
                  value={String(strategyParams.slowPeriod)}
                  onChange={(event) => updateParam('slowPeriod', event.target.value)}
                  inputMode="numeric"
                  className="w-full bg-white/[0.03]"
                />
              </div>
              <div className="min-w-0 space-y-2">
                <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  RSI Period
                </label>
                <Input
                  value={String(strategyParams.rsiPeriod)}
                  onChange={(event) => updateParam('rsiPeriod', event.target.value)}
                  inputMode="numeric"
                  className="w-full bg-white/[0.03]"
                />
              </div>
            </div>
          </Disclosure>

          <div className="rounded-lg border border-border/60 bg-white/[0.02] px-3 py-2.5 text-xs text-muted-foreground">
            {candlesLoading && (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading {symbol} {interval} candles from Binance…
              </span>
            )}
            {!candlesLoading && candlesReady && (
              <span>
                Ready: {candlesQuery.data?.length ?? 0} candles for {symbol} · {interval}
              </span>
            )}
            {!candlesLoading && candlesError && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="inline-flex items-start gap-2 text-danger">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {candlesQuery.error instanceof Error
                    ? candlesQuery.error.message
                    : 'Failed to load candles'}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="min-h-9 w-full sm:w-auto"
                  onClick={() => void candlesQuery.refetch()}
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Retry
                </Button>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              onClick={handleRunBacktest}
              disabled={!canRun}
              className="min-h-11 w-full sm:min-h-9 sm:w-auto"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running Backtest...
                </>
              ) : candlesLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading Candles...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Backtest
                </>
              )}
            </Button>

            <Link to="/optimizer" className="w-full sm:w-auto">
              <Button variant="outline" className="min-h-11 w-full sm:min-h-9 sm:w-auto">
                <Sparkles className="mr-2 h-4 w-4" />
                Random Search
              </Button>
            </Link>

            {hasBacktest && (
              <Link to="/" className="w-full sm:w-auto">
                <Button variant="ghost" className="min-h-11 w-full sm:min-h-9 sm:w-auto">
                  View Dashboard
                </Button>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
