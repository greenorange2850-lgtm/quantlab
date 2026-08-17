import { useEffect, useMemo, useState } from 'react'
import { Search, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MarketSourceFields } from '@/components/market/MarketSourceFields'
import {
  ResearchPeriodSelect,
  defaultResearchPeriodSelection,
} from '@/components/market/ResearchPeriodSelect'
import { useResearchCandles } from '@/api/queries/research-candles'
import { DEFAULT_MARKET_SOURCE, type MarketSourceKind } from '@/data/market-source'
import type { BacktestTimeframe } from '@/data/binance-exchange-info'
import {
  formatPeriodSpan,
  resolveResearchPeriod,
  type ResearchPeriodSelection,
} from '@/data/research-period'
import { defaultBacktestPipelineParams } from '@/core/dashboard'
import {
  aggregateOutcomeStats,
  detectDirectConsumptionSetups,
  loadCandleResearchReviews,
  measureSetupOutcomes,
  saveCandleResearchReview,
  type ManualReviewVerdict,
} from '@/core/candle-research'
import { ReplayCandlestickChart } from '@/features/backtest-replay/components/ReplayCandlestickChart'
import { TradeNavigator } from '@/features/backtest-replay/components/TradeNavigator'
import type { ReplayTradeMarker } from '@/core/backtest/execution-events'
import { formatNumber, formatPercentUnsigned } from '@/lib/utils'

function formatDuration(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`
  return `${(ms / 3_600_000).toFixed(2)}h`
}

function buildSetupMarker(input: {
  setupId: string
  index: number
  setupTime: number
  setupPrice: number
  direction: 'up' | 'down'
}): ReplayTradeMarker {
  const syntheticExitTime = input.setupTime + 1
  return {
    tradeId: input.setupId,
    tradeIndex: input.index,
    direction: input.direction === 'up' ? 'LONG' : 'SHORT',
    entryTime: input.setupTime,
    exitTime: syntheticExitTime,
    entryPrice: input.setupPrice,
    exitPrice: input.setupPrice,
    stopLossPrice: null,
    takeProfitPrice: null,
    pnl: 0,
    commission: 0,
    quantity: 0,
    duration: 0,
    exitReason: null,
    entryReason: 'research_setup',
  }
}

export function CandleResearchPage() {
  const [sourceKind, setSourceKind] = useState<MarketSourceKind>(DEFAULT_MARKET_SOURCE.kind)
  const [datasetId, setDatasetId] = useState<string | null>(null)
  const [symbol, setSymbol] = useState(defaultBacktestPipelineParams.symbol)
  const [interval, setInterval] = useState<BacktestTimeframe>(
    defaultBacktestPipelineParams.interval as BacktestTimeframe,
  )
  const [periodSelection, setPeriodSelection] = useState<ResearchPeriodSelection>(
    defaultResearchPeriodSelection,
  )
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showOverlays, setShowOverlays] = useState(true)
  const [reviewNote, setReviewNote] = useState('')
  const [manualReviews, setManualReviews] = useState(() => loadCandleResearchReviews())

  const resolvedPeriod = useMemo(() => {
    try {
      return { period: resolveResearchPeriod(periodSelection), error: null as string | null }
    } catch (error) {
      return {
        period: null,
        error: error instanceof Error ? error.message : 'Invalid period',
      }
    }
  }, [periodSelection])

  const candlesQuery = useResearchCandles({
    sourceKind,
    datasetId,
    symbol,
    interval,
    startTime: resolvedPeriod.period?.startMs ?? null,
    endTime: resolvedPeriod.period?.endMs ?? null,
  })

  const setups = useMemo(
    () => detectDirectConsumptionSetups(candlesQuery.data ?? []),
    [candlesQuery.data],
  )
  const outcomes = useMemo(
    () =>
      measureSetupOutcomes({
        candles: candlesQuery.data ?? [],
        setups,
        interval,
      }),
    [candlesQuery.data, interval, setups],
  )
  const aggregate = useMemo(() => aggregateOutcomeStats(outcomes), [outcomes])

  useEffect(() => {
    if (selectedIndex >= outcomes.length) {
      setSelectedIndex(Math.max(0, outcomes.length - 1))
    }
  }, [outcomes.length, selectedIndex])

  const selected = outcomes[selectedIndex] ?? null
  const selectedReview = selected ? manualReviews[selected.setup.id] : null

  useEffect(() => {
    setReviewNote(selectedReview?.note ?? '')
  }, [selectedReview?.note, selected?.setup.id])

  const markers = useMemo(
    () =>
      outcomes.map((item, index) =>
        buildSetupMarker({
          setupId: item.setup.id,
          index,
          setupTime: item.setup.setupTime,
          setupPrice: item.setup.setupPrice,
          direction: item.setup.measurementDirection,
        }),
      ),
    [outcomes],
  )

  const selectedMarker = selected ? markers.find((marker) => marker.tradeId === selected.setup.id) : null

  const chartWindow = useMemo(() => {
    const candles = candlesQuery.data ?? []
    if (!selected || candles.length === 0) {
      return candles.slice(Math.max(0, candles.length - 120))
    }
    const center = selected.setup.setupIndex
    const start = Math.max(0, center - 80)
    const end = Math.min(candles.length - 1, center + 120)
    return candles.slice(start, end + 1)
  }, [candlesQuery.data, selected])

  const overlayLines = useMemo(() => {
    if (!selected || !showOverlays) return []
    const ref = selected.setup.referenceCandle
    const bodyTop = Math.max(ref.open, ref.close)
    const bodyBottom = Math.min(ref.open, ref.close)
    const range = bodyTop - bodyBottom
    if (range <= 0) return []

    const thresholds = [40, 50, 60, 70, 80]
    return thresholds.map((threshold) => {
      const ratio = threshold / 100
      const price =
        selected.setup.referenceDirection === 'bullish-reference'
          ? bodyTop - range * ratio
          : bodyBottom + range * ratio
      return {
        id: `${selected.setup.id}-ov-${threshold}`,
        price,
        color: '#38bdf8',
        label: `${threshold}%`,
        dashed: true,
      }
    })
  }, [selected, showOverlays])

  const saveVerdict = (verdict: ManualReviewVerdict) => {
    if (!selected) return
    const record = saveCandleResearchReview({
      setupId: selected.setup.id,
      verdict,
      note: reviewNote,
    })
    setManualReviews((current) => ({ ...current, [record.setupId]: record }))
  }

  const loading = candlesQuery.isLoading || candlesQuery.isFetching

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4">
      <div className="flex min-w-0 items-start gap-3 sm:items-center">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/20 bg-accent/15">
          <Search className="h-5 w-5 text-accent" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">Candle Research</h2>
          <p className="text-pretty text-xs text-muted-foreground">
            Direct Consumption setup detection with objective post-setup outcome measurement.
          </p>
        </div>
      </div>

      <Card glow>
        <CardHeader>
          <CardTitle className="text-base">Dataset</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <MarketSourceFields
            idPrefix="candle-research"
            value={{ sourceKind, datasetId, symbol, interval }}
            onChange={(next) => {
              if (next.sourceKind !== undefined) setSourceKind(next.sourceKind)
              if (next.datasetId !== undefined) setDatasetId(next.datasetId)
              if (next.symbol !== undefined) setSymbol(next.symbol)
              if (next.interval !== undefined) setInterval(next.interval as BacktestTimeframe)
            }}
            onDatasetReady={(dataset) =>
              setPeriodSelection({
                preset: 'custom',
                customStartMs: dataset.startDate,
                customEndMs: dataset.endDate,
              })
            }
          />

          <div className="md:col-span-2">
            <ResearchPeriodSelect
              selection={periodSelection}
              onChange={setPeriodSelection}
              idPrefix="candle-research-period"
            />
          </div>

          <div className="md:col-span-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">Setups {outcomes.length}</Badge>
            {resolvedPeriod.period ? (
              <Badge variant="outline">{formatPeriodSpan(resolvedPeriod.period.startMs, resolvedPeriod.period.endMs)}</Badge>
            ) : null}
            {loading ? <Badge variant="accent">Loading candles…</Badge> : null}
            {resolvedPeriod.error ? <Badge variant="danger">{resolvedPeriod.error}</Badge> : null}
            {candlesQuery.isError ? (
              <Badge variant="danger">
                {candlesQuery.error instanceof Error ? candlesQuery.error.message : 'Failed to load candles'}
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {selected ? (
        <>
          <Card glow>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">Research Chart</CardTitle>
                <div className="flex items-center gap-2 text-xs">
                  <label className="inline-flex items-center gap-1 text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={showOverlays}
                      onChange={(event) => setShowOverlays(event.target.checked)}
                    />
                    40/50/60/70/80 overlays
                  </label>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ReplayCandlestickChart
                candles={chartWindow}
                markers={markers}
                selectedTradeId={selected.setup.id}
                visibleEntryMarkers={selectedMarker ? [selectedMarker] : []}
                visibleExitMarkers={[]}
                highlightedCandleTimes={[selected.setup.referenceTime, selected.setup.setupTime]}
                overlayLines={overlayLines}
              />
            </CardContent>
          </Card>

          <TradeNavigator
            tradeCount={outcomes.length}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card glow>
              <CardHeader>
                <CardTitle className="text-base">Outcome</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <Badge variant="outline">MFE {formatNumber(selected.metrics.mfePrice, 6)}</Badge>
                  <Badge variant="outline">MAE {formatNumber(selected.metrics.maePrice, 6)}</Badge>
                  <Badge variant="outline">
                    max recovery {selected.metrics.maxRecoveryPercent != null ? formatPercentUnsigned(selected.metrics.maxRecoveryPercent, 2) : '—'}
                  </Badge>
                  <Badge variant="outline">time to MFE {formatDuration(selected.metrics.timeToMfeMs)}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Badge variant={selected.metrics.previousHighRetested ? 'success' : 'outline'}>
                    prev HIGH retested {selected.metrics.previousHighRetested ? 'yes' : 'no'}
                  </Badge>
                  <Badge variant={selected.metrics.previousLowRetested ? 'success' : 'outline'}>
                    prev LOW retested {selected.metrics.previousLowRetested ? 'yes' : 'no'}
                  </Badge>
                </div>
                <div className="rounded-lg border border-border/70 p-2">
                  <p className="mb-1 font-medium text-foreground">Time to recovery</p>
                  <p className="text-muted-foreground">
                    0.25: {formatDuration(selected.metrics.timeToRecoveryMs['0.25'])} · 0.50:{' '}
                    {formatDuration(selected.metrics.timeToRecoveryMs['0.50'])} · 0.75:{' '}
                    {formatDuration(selected.metrics.timeToRecoveryMs['0.75'])} · 1.00:{' '}
                    {formatDuration(selected.metrics.timeToRecoveryMs['1.00'])}
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 p-2">
                  <p className="mb-1 font-medium text-foreground">Outcome windows</p>
                  <div className="space-y-1">
                    {selected.metrics.windows.map((window) => (
                      <div key={window.label} className="flex items-center justify-between gap-2 text-[11px]">
                        <span>{window.label}</span>
                        <span className="text-muted-foreground">
                          MFE {formatNumber(window.mfePrice, 6)} · MAE {formatNumber(window.maePrice, 6)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Aggregate Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <Badge variant="outline">total {aggregate.totalSetups}</Badge>
                  <Badge variant="outline">median MFE {aggregate.medianMfePrice != null ? formatNumber(aggregate.medianMfePrice, 6) : '—'}</Badge>
                  <Badge variant="outline">median MAE {aggregate.medianMaePrice != null ? formatNumber(aggregate.medianMaePrice, 6) : '—'}</Badge>
                  <Badge variant="outline">median recovery {formatDuration(aggregate.medianRecoveryTimeMs)}</Badge>
                </div>
                <div className="rounded-lg border border-border/70 p-2 text-muted-foreground">
                  Reach: 0.25 {formatPercentUnsigned(aggregate.reached['0.25'], 1)} · 0.50{' '}
                  {formatPercentUnsigned(aggregate.reached['0.50'], 1)} · 0.75{' '}
                  {formatPercentUnsigned(aggregate.reached['0.75'], 1)} · 1.00{' '}
                  {formatPercentUnsigned(aggregate.reached['1.00'], 1)}
                </div>
                <div className="space-y-1">
                  {aggregate.byPenetrationThreshold.map((item) => (
                    <div
                      key={item.threshold}
                      className="flex items-center justify-between rounded border border-border/60 px-2 py-1 text-[11px]"
                    >
                      <span>{item.threshold}%</span>
                      <span className="text-muted-foreground">
                        n={item.totalSetups} · med MFE {item.medianMfePrice != null ? formatNumber(item.medianMfePrice, 4) : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Manual Review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" onClick={() => saveVerdict('correct')}>Correct</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => saveVerdict('wrong')}>Wrong</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => saveVerdict('unclear')}>Unclear</Button>
                {selectedReview ? (
                  <Badge variant="outline">Saved: {selectedReview.verdict}</Badge>
                ) : (
                  <Badge variant="outline">No manual verdict</Badge>
                )}
              </div>
              <Input
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                placeholder="Optional review note"
              />
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            No Direct Consumption setups found in the selected range.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
