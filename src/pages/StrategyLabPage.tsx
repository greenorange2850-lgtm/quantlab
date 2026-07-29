import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FlaskConical, Play, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { defaultBacktestPipelineParams } from '@/core/dashboard'
import { useBacktestStore } from '@/stores/backtest.store'

export function StrategyLabPage() {
  const navigate = useNavigate()
  const runBacktest = useBacktestStore((state) => state.runBacktest)
  const isRunning = useBacktestStore((state) => state.isRunning)
  const error = useBacktestStore((state) => state.error)
  const hasBacktest = useBacktestStore((state) => state.dashboard.hasBacktest)

  const [symbol, setSymbol] = useState(defaultBacktestPipelineParams.symbol)
  const [interval, setInterval] = useState(defaultBacktestPipelineParams.interval)
  const [limit, setLimit] = useState(String(defaultBacktestPipelineParams.limit))
  const [initialCapital, setInitialCapital] = useState(
    String(defaultBacktestPipelineParams.initialCapital),
  )

  const handleRunBacktest = async () => {
    const parsedLimit = Number(limit)
    const parsedCapital = Number(initialCapital)

    await runBacktest({
      symbol: symbol.trim().toUpperCase(),
      interval: interval.trim(),
      limit: Number.isFinite(parsedLimit) ? parsedLimit : defaultBacktestPipelineParams.limit,
      initialCapital: Number.isFinite(parsedCapital)
        ? parsedCapital
        : defaultBacktestPipelineParams.initialCapital,
    })

    if (!useBacktestStore.getState().error) {
      navigate('/')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto w-full max-w-3xl min-w-0 space-y-6"
    >
      <div className="flex min-w-0 items-start gap-3 sm:items-center">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/20 bg-accent/15">
          <FlaskConical className="h-5 w-5 text-accent" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">Strategy Lab</h2>
          <p className="text-pretty text-xs text-muted-foreground">
            Run a backtest through the strategy, risk, and analytics pipeline.
          </p>
        </div>
      </div>

      <Card glow>
        <CardHeader>
          <CardTitle className="text-base">Run Backtest</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Strategy
              </label>
              <Input value="Moving Average Cross" disabled className="w-full bg-white/[0.03]" />
            </div>
            <div className="min-w-0 space-y-2">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Symbol
              </label>
              <Input
                value={symbol}
                onChange={(event) => setSymbol(event.target.value)}
                className="w-full bg-white/[0.03]"
              />
            </div>
            <div className="min-w-0 space-y-2">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Interval
              </label>
              <Input
                value={interval}
                onChange={(event) => setInterval(event.target.value)}
                className="w-full bg-white/[0.03]"
              />
            </div>
            <div className="min-w-0 space-y-2">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Candle Limit
              </label>
              <Input
                value={limit}
                onChange={(event) => setLimit(event.target.value)}
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
                className="w-full bg-white/[0.03]"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              onClick={handleRunBacktest}
              disabled={isRunning}
              className="min-h-11 w-full sm:min-h-9 sm:w-auto"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running Backtest...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Backtest
                </>
              )}
            </Button>

            {hasBacktest && (
              <Link to="/" className="w-full sm:w-auto">
                <Button variant="secondary" className="min-h-11 w-full sm:min-h-9 sm:w-auto">
                  View Dashboard
                </Button>
              </Link>
            )}

            <Badge variant="outline" className="w-fit text-[10px]">
              Mock market data
            </Badge>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
