import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import type { EquityPoint } from '@/core/backtest/BacktestResult'
import type { Trade } from '@/core/backtest/Trade'
import type { BacktestExecutionEventKind } from '@/core/backtest/execution-events'
import type { BacktestReplayBundle } from '@/data/replay'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Disclosure } from '@/components/ui/disclosure'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency, formatPercent } from '@/lib/utils'
import { PlaybookSetupNavigator } from '@/features/playbook/components/PlaybookSetupNavigator'
import { SelectedPlaybookSetupCard } from '@/features/playbook/components/SelectedPlaybookSetupCard'
import {
  buildPlaybookReplayOverlay,
  findSetupIndexByCandle,
  parsePlaybookReplaySearch,
  playbookChartPresentation,
  replayCursorForSetup,
  replayPageQueryIsValid,
  type PlaybookReplayOverlay,
} from '@/features/playbook/replay-markers'
import { usePlaybookStore } from '@/stores/playbook.store'
import { BacktestSummaryStrip } from './components/BacktestSummaryStrip'
import { EquityReplayPanel } from './components/EquityReplayPanel'
import { ExecutionAssumptions } from './components/ExecutionAssumptions'
import { ReplayCandlestickChart } from './components/ReplayCandlestickChart'
import { ReplayControls } from './components/ReplayControls'
import { SelectedTradeCard } from './components/SelectedTradeCard'
import { SignalVerificationCard } from './components/SignalVerificationCard'
import { TradeListPanel } from './components/TradeListPanel'
import { TradeNavigator } from './components/TradeNavigator'
import { VerifyTradePanel } from './components/VerifyTradePanel'
import { loadReplayPageSource, type ReplayPageLoadResult } from './load-playbook-replay'
import { buildSignalVerification } from './signal-verification'
import {
  buildTradeMarkers,
  exitsVisibleAtCursor,
  markersVisibleAtCursor,
} from './trade-markers'
import {
  candlesVisibleForReplay,
  chartWindowForReplay,
  createInitialReplayState,
  findCandleIndex,
  msPerCandle,
  stepCursor,
  type ReplayControllerState,
  type ReplaySpeedMultiplier,
} from './replay-window'

type LoadState =
  | { status: 'idle' | 'loading'; availability: null }
  | { status: 'ready'; availability: Extract<ReplayPageLoadResult, { available: true }> }
  | { status: 'unavailable'; availability: Extract<ReplayPageLoadResult, { available: false }> }
  | { status: 'error'; message: string; availability: null }

const EVENT_LABELS: Record<BacktestExecutionEventKind, string> = {
  signal_evaluated: 'Signals evaluated',
  signal_queued: 'Orders queued',
  order_skipped: 'Orders skipped',
  fill_applied: 'Fills applied',
  trade_opened: 'Trades opened',
  trade_closed: 'Trades closed',
}

function resolveEquityCurve(bundle: BacktestReplayBundle): EquityPoint[] {
  if (bundle.equityCurve.length > 0) return bundle.equityCurve
  // Legacy bundles without a persisted curve — use endpoints only.
  return [
    {
      time: bundle.candles[0]?.time ?? Date.now(),
      equity: bundle.metadata.initialCapital,
      cash: bundle.metadata.initialCapital,
    },
    {
      time: bundle.candles.at(-1)?.time ?? Date.now(),
      equity: bundle.metadata.finalEquity,
      cash: bundle.metadata.finalEquity,
    },
  ]
}

function LoadingReplayPage() {
  return (
    <div className="min-w-0 space-y-4">
      <Skeleton className="h-12 rounded-xl" />
      <Skeleton className="h-[260px] rounded-xl" />
      <Skeleton className="h-36 rounded-xl" />
    </div>
  )
}

function EmptyReplayMessage({ title, message }: { title: string; message: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="space-y-4 py-8 text-center">
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="mt-2 text-xs text-muted-foreground">{message}</p>
        </div>
        <Link to="/">
          <Button className="min-h-11">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}

function FunnelPanel({ bundle }: { bundle: BacktestReplayBundle }) {
  const counts = bundle.events.reduce<Record<BacktestExecutionEventKind, number>>(
    (acc, event) => {
      acc[event.kind] += 1
      return acc
    },
    {
      signal_evaluated: 0,
      signal_queued: 0,
      order_skipped: 0,
      fill_applied: 0,
      trade_opened: 0,
      trade_closed: 0,
    },
  )

  return (
    <Disclosure title="Execution Funnel">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {(Object.keys(EVENT_LABELS) as BacktestExecutionEventKind[]).map((kind) => (
          <div key={kind} className="rounded-lg border border-border/60 bg-white/[0.02] p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {EVENT_LABELS[kind]}
            </p>
            <p className="mt-1 font-mono text-lg font-semibold text-foreground">{counts[kind]}</p>
          </div>
        ))}
      </div>
      {bundle.events.length === 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Detailed execution events are unavailable for this replay; trade markers still come from
          persisted trades.
        </p>
      )}
    </Disclosure>
  )
}

function TradeSelectBridge({
  trades,
  selectedTradeId,
  onSelectIndex,
}: {
  trades: Trade[]
  selectedTradeId: string | null
  onSelectIndex: (index: number) => void
}) {
  return (
    <TradeListPanel
      trades={trades}
      selectedTradeId={selectedTradeId}
      onSelect={(trade) => {
        const index = trades.findIndex((item) => item.id === trade.id)
        if (index >= 0) onSelectIndex(index)
      }}
    />
  )
}

export function BacktestReplayPage() {
  const [searchParams] = useSearchParams()
  const query = useMemo(() => parsePlaybookReplaySearch(searchParams), [searchParams])
  const queryValid = replayPageQueryIsValid(query)
  const applied = usePlaybookStore((s) => s.applied)
  const drafts = usePlaybookStore((s) => s.drafts)
  const [loadState, setLoadState] = useState<LoadState>({ status: 'idle', availability: null })
  const [selectedTradeIndex, setSelectedTradeIndex] = useState(0)
  const [selectedSetupIndex, setSelectedSetupIndex] = useState(0)
  const [replayState, setReplayState] = useState<ReplayControllerState>(() =>
    createInitialReplayState(0, true),
  )
  const focusedQueryKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!queryValid) {
      setLoadState({ status: 'idle', availability: null })
      return
    }

    let cancelled = false
    setLoadState({ status: 'loading', availability: null })
    focusedQueryKeyRef.current = null
    void loadReplayPageSource(query)
      .then((availability) => {
        if (cancelled) return
        if (availability.available) {
          setLoadState({ status: 'ready', availability })
          setSelectedTradeIndex(0)
          setSelectedSetupIndex(0)
          setReplayState(createInitialReplayState(availability.bundle.candles.length, true))
        } else {
          setLoadState({ status: 'unavailable', availability })
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setLoadState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Unable to load replay data.',
          availability: null,
        })
      })

    return () => {
      cancelled = true
    }
  }, [
    queryValid,
    query.backtestId,
    query.datasetId,
    query.playbookId,
    query.timeframe,
    query.setupCandleIndex,
  ])

  const bundle = loadState.status === 'ready' ? loadState.availability.bundle : null
  const detectorEvents = loadState.status === 'ready' ? loadState.availability.detectorEvents : []
  const playbookParameters = query.playbookId
    ? (applied[query.playbookId] ?? drafts[query.playbookId])
    : undefined

  const overlay = useMemo((): PlaybookReplayOverlay | null => {
    if (!bundle || !query.playbookId) return null
    try {
      return buildPlaybookReplayOverlay({
        playbookId: query.playbookId,
        parameters: playbookParameters,
        symbol: bundle.metadata.symbol,
        timeframe: bundle.metadata.timeframe,
        candles: bundle.candles,
        detectorEvents,
      })
    } catch {
      return null
    }
  }, [
    bundle,
    detectorEvents,
    playbookParameters,
    query.playbookId,
  ])

  const markers = useMemo(
    () => (bundle ? buildTradeMarkers(bundle.trades, bundle.events) : []),
    [bundle],
  )
  const equityCurve = useMemo(() => (bundle ? resolveEquityCurve(bundle) : []), [bundle])
  const selectedTrade = bundle?.trades[selectedTradeIndex] ?? null
  const selectedMarker = selectedTrade
    ? markers.find((marker) => marker.tradeId === selectedTrade.id) ?? null
    : null
  const selectedPlaybookMarker = overlay?.markers[selectedSetupIndex] ?? null
  const cursorTime =
    bundle && replayState.mode === 'replay'
      ? bundle.candles[replayState.cursorIndex]?.time ?? null
      : null

  useEffect(() => {
    if (!bundle || !replayState.playing) return
    const interval = window.setInterval(() => {
      setReplayState((current) => {
        const nextIndex = Math.min(bundle.candles.length - 1, current.cursorIndex + 1)
        return {
          ...current,
          cursorIndex: nextIndex,
          mode: 'replay',
          playing: nextIndex < bundle.candles.length - 1,
        }
      })
    }, msPerCandle(replayState.speed))

    return () => window.clearInterval(interval)
  }, [bundle, replayState.playing, replayState.speed])

  const selectPlaybookSetup = (index: number) => {
    if (!overlay || overlay.markers.length === 0) return
    const next = Math.max(0, Math.min(overlay.markers.length - 1, index))
    const marker = overlay.markers[next]
    if (!marker) return
    setSelectedSetupIndex(next)
    setReplayState((current) => ({
      ...current,
      ...replayCursorForSetup(marker),
    }))
  }

  useEffect(() => {
    if (!overlay || overlay.markers.length === 0) return
    const key = `${query.backtestId}:${query.datasetId}:${query.playbookId}:${query.setupCandleIndex}`
    if (focusedQueryKeyRef.current === key) return
    focusedQueryKeyRef.current = key
    const index =
      query.setupCandleIndex != null
        ? findSetupIndexByCandle(overlay.markers, query.setupCandleIndex)
        : overlay.markers.length - 1
    if (index < 0) return
    const marker = overlay.markers[index]
    if (!marker) return
    setSelectedSetupIndex(index)
    setReplayState((current) => ({
      ...current,
      ...replayCursorForSetup(marker),
    }))
  }, [
    overlay,
    query.backtestId,
    query.datasetId,
    query.playbookId,
    query.setupCandleIndex,
  ])

  const visibleFullSeries = useMemo(() => {
    if (!bundle) return []
    return replayState.mode === 'replay'
      ? candlesVisibleForReplay(bundle.candles, replayState.cursorIndex)
      : bundle.candles
  }, [bundle, replayState.cursorIndex, replayState.mode])

  const playbookFocusTimeMs =
    overlay && selectedPlaybookMarker && replayState.mode === 'replay'
      ? selectedPlaybookMarker.timeMs
      : null

  const chartWindow = useMemo(
    () =>
      chartWindowForReplay({
        visibleCandles: visibleFullSeries,
        mode: replayState.mode,
        selectedTrade,
        playbookFocusTimeMs,
      }),
    [playbookFocusTimeMs, replayState.mode, selectedTrade, visibleFullSeries],
  )

  const visibleEntryMarkers = useMemo(
    () => markersVisibleAtCursor(markers, cursorTime, replayState.mode),
    [cursorTime, markers, replayState.mode],
  )
  const visibleExitMarkers = useMemo(
    () => exitsVisibleAtCursor(markers, cursorTime, replayState.mode),
    [cursorTime, markers, replayState.mode],
  )
  const playbookChart = useMemo(
    () =>
      playbookChartPresentation(
        overlay?.markers ?? [],
        replayState.mode === 'replay' ? replayState.cursorIndex : null,
        replayState.mode,
      ),
    [overlay?.markers, replayState.cursorIndex, replayState.mode],
  )

  const signalSnapshot = useMemo(() => {
    if (!bundle || !selectedTrade) return null
    const entryIndex = findCandleIndex(bundle.candles, selectedTrade.entryTime)
    const signalIndex = entryIndex > 0 ? entryIndex - 1 : entryIndex
    return buildSignalVerification({
      candles: bundle.candles,
      candleIndex: signalIndex,
      strategyParams: bundle.metadata.strategyParams,
      events: bundle.events,
      trades: [selectedTrade],
    })
  }, [bundle, selectedTrade])

  const selectTradeIndex = (index: number) => {
    if (!bundle) return
    const next = Math.max(0, Math.min(bundle.trades.length - 1, index))
    setSelectedTradeIndex(next)
    setReplayState((current) => ({
      ...current,
      cursorIndex: Math.max(0, bundle.candles.length - 1),
      mode: 'full',
      playing: false,
    }))
  }

  if (!queryValid) {
    return (
      <EmptyReplayMessage
        title="Replay needs a backtest or Playbook source"
        message="Open replay from a completed backtest, Playbook Lab Historical, or add ?backtest=<id> to the URL."
      />
    )
  }

  if (loadState.status === 'idle' || loadState.status === 'loading') {
    return <LoadingReplayPage />
  }

  if (loadState.status === 'unavailable') {
    return (
      <EmptyReplayMessage
        title="Replay unavailable"
        message={loadState.availability.message}
      />
    )
  }

  if (loadState.status === 'error') {
    return <EmptyReplayMessage title="Replay failed to load" message={loadState.message} />
  }

  if (!bundle) {
    return (
      <EmptyReplayMessage
        title="Replay unavailable"
        message="Replay data could not be loaded for this backtest."
      />
    )
  }

  if (loadState.status !== 'ready') {
    return (
      <EmptyReplayMessage
        title="Replay unavailable"
        message="Replay data could not be loaded for this backtest."
      />
    )
  }

  const replaySource = loadState.availability.source

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to dashboard
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground">Backtest Replay</h1>
            <Badge variant="outline" className="font-mono">
              {bundle.metadata.symbol}
            </Badge>
            <Badge variant="outline" className="font-mono">
              {bundle.metadata.timeframe}
            </Badge>
            <Badge variant={replaySource === 'indexeddb' ? 'accent' : 'outline'}>
              {replaySource}
            </Badge>
            {overlay ? (
              <Badge variant="outline">Playbook overlay</Badge>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {bundle.metadata.strategyName} {bundle.metadata.strategyVersion} · {bundle.candles.length}{' '}
            candles · {bundle.trades.length} trades
          </p>
        </div>
      </div>

      <BacktestSummaryStrip summary={bundle.reportSummary} />

      <Card glow>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Replay Chart</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                BUY/SELL labels mark entries; EXIT diamonds mark closed trades.
                {overlay
                  ? ' Playbook labels mark setup state transitions at that candle.'
                  : ''}
              </p>
            </div>
            {selectedTrade && (
              <Badge variant={selectedTrade.pnl >= 0 ? 'success' : 'danger'} className="shrink-0">
                {formatCurrency(selectedTrade.pnl)} /{' '}
                {bundle.reportSummary
                  ? formatPercent((selectedTrade.pnl / Math.max(1, bundle.metadata.initialCapital)) * 100)
                  : 'Unavailable'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <ReplayCandlestickChart
            candles={chartWindow.candles}
            markers={markers}
            selectedTradeId={selectedTrade?.id ?? null}
            visibleEntryMarkers={visibleEntryMarkers}
            visibleExitMarkers={visibleExitMarkers}
            playbookMarkers={playbookChart.markers}
            selectedPlaybookMarkerId={selectedPlaybookMarker?.id ?? null}
            showPlaybookLifecycleOutcome={playbookChart.showLifecycleOutcome}
            onSelectPlaybookMarker={(markerId) => {
              const index = overlay?.markers.findIndex((marker) => marker.id === markerId) ?? -1
              if (index >= 0) selectPlaybookSetup(index)
            }}
          />
        </CardContent>
      </Card>

      {overlay ? (
        <>
          <PlaybookSetupNavigator
            setupCount={overlay.markers.length}
            selectedIndex={Math.min(
              selectedSetupIndex,
              Math.max(0, overlay.markers.length - 1),
            )}
            onSelect={selectPlaybookSetup}
          />
          <SelectedPlaybookSetupCard
            marker={selectedPlaybookMarker}
            replayMode={replayState.mode}
          />
        </>
      ) : query.playbookId ? (
        <p className="text-xs text-muted-foreground">
          Playbook overlay unavailable for “{query.playbookId}”. Trade replay is unchanged.
        </p>
      ) : null}

      {bundle.trades.length > 0 ? (
        <>
          <TradeNavigator
            tradeCount={bundle.trades.length}
            selectedIndex={Math.min(selectedTradeIndex, Math.max(0, bundle.trades.length - 1))}
            onSelect={selectTradeIndex}
          />
          <SelectedTradeCard trade={selectedTrade} marker={selectedMarker} />
        </>
      ) : null}

      <ReplayControls
        state={replayState}
        candleCount={bundle.candles.length}
        onPlay={() => {
          setReplayState((current) => ({
            ...current,
            cursorIndex:
              current.mode === 'full' || current.cursorIndex >= bundle.candles.length - 1
                ? -1
                : current.cursorIndex,
            mode: 'replay',
            playing: true,
          }))
        }}
        onPause={() => setReplayState((current) => ({ ...current, playing: false }))}
        onRestart={() => setReplayState(createInitialReplayState(bundle.candles.length, false))}
        onStep={(steps) =>
          setReplayState((current) => stepCursor(current, bundle.candles.length, steps))
        }
        onSpeedChange={(speed: ReplaySpeedMultiplier) =>
          setReplayState((current) => ({ ...current, speed }))
        }
      />

      <div className="space-y-3">
        {bundle.trades.length > 0 ? (
          <>
            <Disclosure title="Signal verification">
              <SignalVerificationCard snapshot={signalSnapshot} />
            </Disclosure>

            <Disclosure title="Verify selected trade">
              <VerifyTradePanel
                trade={selectedTrade}
                candles={bundle.candles}
                events={bundle.events}
                strategyParams={bundle.metadata.strategyParams}
              />
            </Disclosure>
          </>
        ) : null}

        <FunnelPanel bundle={bundle} />

        {bundle.trades.length > 0 ? (
          <TradeSelectBridge
            trades={bundle.trades}
            selectedTradeId={selectedTrade?.id ?? null}
            onSelectIndex={selectTradeIndex}
          />
        ) : null}

        <Disclosure title="Equity replay">
          <EquityReplayPanel
            initialCapital={bundle.metadata.initialCapital}
            finalEquity={bundle.metadata.finalEquity}
            equityCurve={equityCurve}
            trades={bundle.trades}
            cursorTime={cursorTime}
          />
        </Disclosure>

        <ExecutionAssumptions />
      </div>
    </div>
  )
}
