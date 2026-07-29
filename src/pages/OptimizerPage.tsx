import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  FlaskConical,
  Loader2,
  Play,
  RefreshCw,
  Square,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { SymbolSelect } from '@/components/market/SymbolSelect'
import { TimeframeSelect } from '@/components/market/TimeframeSelect'
import { useBinanceKlines } from '@/api/queries/binance-market'
import { useResearchSession } from '@/api/queries/research-sessions'
import { defaultBacktestPipelineParams } from '@/core/dashboard'
import {
  type ParameterRange,
  type ScoringObjective,
} from '@/core/research'
import type { BacktestTimeframe } from '@/data/binance-exchange-info'
import { formatCurrency, formatPercent, cn } from '@/lib/utils'
import {
  defaultRandomSearchDraft,
  useResearchStore,
} from '@/stores/research.store'
import { useBacktestStore } from '@/stores/backtest.store'

const OBJECTIVES: { id: ScoringObjective; label: string }[] = [
  { id: 'profitFactor', label: 'Profit Factor' },
  { id: 'netProfit', label: 'Net Profit' },
  { id: 'winRate', label: 'Win Rate' },
  { id: 'expectancy', label: 'Expectancy' },
]

function parseOptionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function OptimizerPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const analysisSessionId = searchParams.get('analysis')

  const status = useResearchStore((state) => state.status)
  const progress = useResearchStore((state) => state.progress)
  const liveReport = useResearchStore((state) => state.report)
  const error = useResearchStore((state) => state.error)
  const validationErrors = useResearchStore((state) => state.validationErrors)
  const selectedCandidateId = useResearchStore((state) => state.selectedCandidateId)
  const startRandomSearch = useResearchStore((state) => state.startRandomSearch)
  const cancelRandomSearch = useResearchStore((state) => state.cancelRandomSearch)
  const applyParameters = useResearchStore((state) => state.applyParameters)
  const selectCandidate = useResearchStore((state) => state.selectCandidate)
  const clearError = useResearchStore((state) => state.clearError)
  const restoreBacktest = useBacktestStore((state) => state.restoreBacktest)

  const archivedSession = useResearchSession(analysisSessionId)
  const report = liveReport ?? archivedSession.data?.report ?? null

  useEffect(() => {
    if (!analysisSessionId) return
    const el = document.getElementById('research-analysis')
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [analysisSessionId, report?.sessionId])

  const [symbol, setSymbol] = useState(defaultBacktestPipelineParams.symbol)
  const [interval, setInterval] = useState<BacktestTimeframe>(
    defaultBacktestPipelineParams.interval as BacktestTimeframe,
  )
  const [limit, setLimit] = useState(String(defaultBacktestPipelineParams.limit))
  const [initialCapital, setInitialCapital] = useState(
    String(defaultBacktestPipelineParams.initialCapital),
  )
  const [iterations, setIterations] = useState(String(defaultRandomSearchDraft.iterations))
  const [objective, setObjective] = useState<ScoringObjective>(defaultRandomSearchDraft.objective)
  const [ranges, setRanges] = useState<ParameterRange[]>(
    defaultRandomSearchDraft.parameterRanges.map((range) => ({ ...range })),
  )
  const [maxDrawdownPercent, setMaxDrawdownPercent] = useState('')
  const [minimumTrades, setMinimumTrades] = useState('')
  const [minimumProfitFactor, setMinimumProfitFactor] = useState('')

  const parsedLimit = useMemo(() => {
    const value = Number(limit)
    return Number.isFinite(value) && value >= 1
      ? Math.min(Math.floor(value), 1000)
      : defaultBacktestPipelineParams.limit
  }, [limit])

  const candlesQuery = useBinanceKlines(symbol, interval, parsedLimit)
  const candlesReady = Boolean(candlesQuery.data?.length)
  const isRunning = status === 'running'
  const selected =
    report?.topCandidates.find((candidate) => candidate.id === selectedCandidateId) ??
    report?.bestCandidate ??
    null

  const updateRange = (name: ParameterRange['name'], field: 'min' | 'max' | 'step', raw: string) => {
    const value = Number(raw)
    setRanges((current) =>
      current.map((range) =>
        range.name === name
          ? { ...range, [field]: Number.isFinite(value) ? value : range[field] }
          : range,
      ),
    )
  }

  const handleStart = async () => {
    clearError()
    if (!candlesQuery.data?.length) return

    const maxDd = parseOptionalNumber(maxDrawdownPercent)
    await startRandomSearch({
      candles: candlesQuery.data,
      config: {
        iterations: Number(iterations),
        parameterRanges: ranges,
        objective,
        symbol,
        interval,
        limit: parsedLimit,
        initialCapital: Number(initialCapital) || defaultBacktestPipelineParams.initialCapital,
        constraints: {
          maxDrawdown: maxDd !== undefined ? maxDd / 100 : undefined,
          minimumTrades: parseOptionalNumber(minimumTrades),
          minimumProfitFactor: parseOptionalNumber(minimumProfitFactor),
        },
      },
    })
  }

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-6">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/20 bg-accent/15">
            <Sparkles className="h-5 w-5 text-accent" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight">Random Search</h2>
            <p className="text-pretty text-xs text-muted-foreground">
              Explore parameter combinations. This is not a single backtest —{' '}
              <span className="text-foreground">Run Backtest</span> evaluates one setup;{' '}
              <span className="text-foreground">Random Search</span> samples many.
            </p>
          </div>
        </div>
        <Link to="/strategy-lab" className="w-full sm:w-auto">
          <Button variant="secondary" className="min-h-11 w-full sm:min-h-9 sm:w-auto">
            <FlaskConical className="mr-2 h-4 w-4" />
            Strategy Lab
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Market pair
              </label>
              <SymbolSelect value={symbol} onChange={setSymbol} disabled={isRunning} />
            </div>
            <div className="min-w-0 space-y-2">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Timeframe
              </label>
              <TimeframeSelect value={interval} onChange={setInterval} disabled={isRunning} />
            </div>
            <div className="min-w-0 space-y-2">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Candle limit
              </label>
              <Input
                value={limit}
                disabled={isRunning}
                onChange={(event) => setLimit(event.target.value)}
                className="w-full bg-white/[0.03]"
              />
            </div>
            <div className="min-w-0 space-y-2">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Initial capital
              </label>
              <Input
                value={initialCapital}
                disabled={isRunning}
                onChange={(event) => setInitialCapital(event.target.value)}
                className="w-full bg-white/[0.03]"
              />
            </div>
            <div className="min-w-0 space-y-2">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Iterations
              </label>
              <Input
                value={iterations}
                disabled={isRunning}
                onChange={(event) => setIterations(event.target.value)}
                className="w-full bg-white/[0.03]"
              />
            </div>
            <div className="min-w-0 space-y-2">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Scoring objective
              </label>
              <select
                value={objective}
                disabled={isRunning}
                onChange={(event) => setObjective(event.target.value as ScoringObjective)}
                className="flex h-11 w-full rounded-lg border border-border bg-white/[0.03] px-3 text-sm"
              >
                {OBJECTIVES.map((item) => (
                  <option key={item.id} value={item.id} className="bg-card-solid">
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Parameter ranges
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {ranges.map((range) => (
                <div key={range.name} className="min-w-0 rounded-lg border border-border/60 p-3 space-y-2">
                  <p className="font-mono text-xs font-medium">{range.name}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['min', 'max', 'step'] as const).map((field) => (
                      <div key={field} className="min-w-0 space-y-1">
                        <label className="text-[10px] uppercase text-muted-foreground">{field}</label>
                        <Input
                          value={String(range[field])}
                          disabled={isRunning}
                          onChange={(event) => updateRange(range.name, field, event.target.value)}
                          className="h-9 bg-white/[0.03] px-2 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="min-w-0 space-y-2">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Max drawdown % (optional)
              </label>
              <Input
                value={maxDrawdownPercent}
                disabled={isRunning}
                placeholder="e.g. 20"
                onChange={(event) => setMaxDrawdownPercent(event.target.value)}
                className="w-full bg-white/[0.03]"
              />
            </div>
            <div className="min-w-0 space-y-2">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Min trades (optional)
              </label>
              <Input
                value={minimumTrades}
                disabled={isRunning}
                placeholder="e.g. 10"
                onChange={(event) => setMinimumTrades(event.target.value)}
                className="w-full bg-white/[0.03]"
              />
            </div>
            <div className="min-w-0 space-y-2">
              <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Min profit factor (optional)
              </label>
              <Input
                value={minimumProfitFactor}
                disabled={isRunning}
                placeholder="e.g. 1.2"
                onChange={(event) => setMinimumProfitFactor(event.target.value)}
                className="w-full bg-white/[0.03]"
              />
            </div>
          </div>

          {(validationErrors.length > 0 || error) && status !== 'running' && (
            <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger space-y-1">
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="h-3.5 w-3.5" />
                {error ?? 'Invalid configuration'}
              </div>
              {validationErrors.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              className="min-h-11 w-full sm:min-h-9 sm:w-auto"
              disabled={isRunning || !candlesReady || candlesQuery.isFetching}
              onClick={() => void handleStart()}
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching…
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start Random Search
                </>
              )}
            </Button>
            {isRunning && (
              <Button
                variant="secondary"
                className="min-h-11 w-full sm:min-h-9 sm:w-auto"
                onClick={cancelRandomSearch}
              >
                <Square className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            )}
            {status === 'failed' && (
              <Button
                variant="secondary"
                className="min-h-11 w-full sm:min-h-9 sm:w-auto"
                onClick={() => void handleStart()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            )}
            <Badge variant="outline" className="w-fit text-[10px]">
              Uses existing backtest pipeline + report metrics
            </Badge>
          </div>
        </CardContent>
      </Card>

      {(isRunning || progress) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>
                {progress?.completed ?? 0} / {progress?.total ?? iterations} iterations
              </span>
              <span>
                Best score:{' '}
                <span className="font-mono text-foreground">
                  {progress?.bestScore === null || progress?.bestScore === undefined
                    ? '—'
                    : progress.bestScore.toFixed(3)}
                </span>
              </span>
              <Badge variant="accent" className="text-[10px] capitalize">
                {status}
              </Badge>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{
                  width: `${
                    progress && progress.total > 0
                      ? Math.min(100, (progress.completed / progress.total) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {status === 'empty' && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Search finished but no candidates passed the configured constraints.
          </CardContent>
        </Card>
      )}

      {status === 'cancelled' && (
        <Card>
          <CardContent className="py-4 text-xs text-muted-foreground">
            Random Search cancelled after {progress?.completed ?? 0} iterations.
            Partial results are available below when present.
          </CardContent>
        </Card>
      )}

      {report && report.topCandidates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Results</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 space-y-4">
            {report.bestCandidate && (
              <div className="rounded-lg border border-accent/30 bg-accent/5 p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">Best candidate</p>
                  <Badge variant="accent" className="text-[10px]">
                    score {report.bestCandidate.score.toFixed(3)}
                  </Badge>
                </div>
                <p className="font-mono text-xs text-muted-foreground">
                  fast={report.bestCandidate.parameters.fastPeriod} · slow=
                  {report.bestCandidate.parameters.slowPeriod} · rsi=
                  {report.bestCandidate.parameters.rsiPeriod}
                </p>
              </div>
            )}

            <div className="space-y-2 md:hidden">
              {report.topCandidates.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  onClick={() => selectCandidate(candidate.id)}
                  className={cn(
                    'w-full min-w-0 rounded-lg border p-4 text-left space-y-2',
                    selectedCandidateId === candidate.id
                      ? 'border-accent/40 bg-accent/5'
                      : 'border-border/60',
                  )}
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-mono text-xs">
                      {candidate.parameters.fastPeriod}/{candidate.parameters.slowPeriod}/
                      {candidate.parameters.rsiPeriod}
                    </span>
                    <span className="font-mono text-xs">{candidate.score.toFixed(2)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                    <span>PF {candidate.report.summary.profitFactor.toFixed(2)}</span>
                    <span>WR {(candidate.report.summary.winRate * 100).toFixed(1)}%</span>
                    <span>DD {formatPercent(-candidate.report.summary.maxDrawdown * 100)}</span>
                    <span>{candidate.report.summary.totalTrades} trades</span>
                    <span className="col-span-2">
                      Net {formatCurrency(candidate.report.summary.netProfit)}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div className="hidden min-w-0 overflow-x-auto md:block">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2">Params</th>
                    <th className="px-3 py-2">Score</th>
                    <th className="px-3 py-2">PF</th>
                    <th className="px-3 py-2">Max DD</th>
                    <th className="px-3 py-2">Win Rate</th>
                    <th className="px-3 py-2">Trades</th>
                    <th className="px-3 py-2">Net Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topCandidates.map((candidate) => (
                    <tr
                      key={candidate.id}
                      className={cn(
                        'cursor-pointer border-b border-border/50 hover:bg-white/[0.02]',
                        selectedCandidateId === candidate.id && 'bg-accent/5',
                      )}
                      onClick={() => selectCandidate(candidate.id)}
                    >
                      <td className="px-3 py-2 font-mono">
                        {candidate.parameters.fastPeriod}/{candidate.parameters.slowPeriod}/
                        {candidate.parameters.rsiPeriod}
                      </td>
                      <td className="px-3 py-2 font-mono">{candidate.score.toFixed(3)}</td>
                      <td className="px-3 py-2 font-mono">
                        {candidate.report.summary.profitFactor.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 font-mono text-danger">
                        {formatPercent(-candidate.report.summary.maxDrawdown * 100)}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {(candidate.report.summary.winRate * 100).toFixed(1)}%
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {candidate.report.summary.totalTrades}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {formatCurrency(candidate.report.summary.netProfit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selected && (
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  className="min-h-11 w-full sm:min-h-9 sm:w-auto"
                  onClick={() => {
                    applyParameters(selected.parameters)
                    navigate('/strategy-lab')
                  }}
                >
                  Apply Parameters
                </Button>
                <Button
                  variant="secondary"
                  className="min-h-11 w-full sm:min-h-9 sm:w-auto"
                  onClick={() => {
                    void restoreBacktest(selected.backtestId).then(() => {
                      navigate('/')
                    })
                  }}
                >
                  View Details
                </Button>
                <Button
                  variant="secondary"
                  className="min-h-11 w-full sm:min-h-9 sm:w-auto"
                  onClick={() => {
                    navigate(`/research-analysis?session=${report.sessionId}`)
                  }}
                >
                  View Analysis
                </Button>
                <Button
                  variant="secondary"
                  className="min-h-11 w-full sm:min-h-9 sm:w-auto"
                  onClick={() => {
                    navigate(
                      `/strategy-compare?session=${report.sessionId}&candidate=${selected.id}`,
                    )
                  }}
                >
                  Compare
                </Button>
                <p className="w-full text-[11px] text-muted-foreground">
                  Apply Parameters updates Strategy Lab fields only — it does not save or rerun.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {report && (
        <Card id="research-analysis">
          <CardHeader>
            <CardTitle className="text-base">Research analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <p>
              Session <span className="font-mono text-foreground">{report.sessionId}</span> ·{' '}
              {report.candidatesEvaluated} evaluated · {report.candidatesPassingConstraints} passed
              constraints · objective <span className="text-foreground">{report.objective}</span>
            </p>
            {report.bestCandidate && (
              <p className="font-mono text-foreground">
                Best score {report.bestCandidate.score.toFixed(3)} · PF{' '}
                {report.bestCandidate.report.summary.profitFactor.toFixed(2)} · DD{' '}
                {formatPercent(-report.bestCandidate.report.summary.maxDrawdown * 100)} · Net{' '}
                {formatCurrency(report.bestCandidate.report.summary.netProfit)}
              </p>
            )}
            <p>
              Report generated by <code className="text-foreground">buildResearchReport()</code>{' '}
              from archived session scores — metrics are not recomputed in the UI.
            </p>
            {archivedSession.isError && analysisSessionId && !liveReport && (
              <p className="text-danger">
                {archivedSession.error instanceof Error
                  ? archivedSession.error.message
                  : 'Failed to load research session'}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
