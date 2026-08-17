import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DIRECT_CONSUMPTION_THRESHOLDS,
  clearCandleResearchReview,
  detectDirectConsumptionSetups,
  extractCandleFeatures,
  listCandleResearchReviews,
  saveCandleResearchReview,
  type ResearchReviewVerdict,
} from '@/core/candle-research'
import { ReplayCandlestickChart } from '@/features/backtest-replay/components/ReplayCandlestickChart'
import { ReplayControls } from '@/features/backtest-replay/components/ReplayControls'
import { loadBacktestReplay, type ReplayAvailability } from '@/features/backtest-replay/load-replay'
import {
  candlesVisibleForReplay,
  createInitialReplayState,
  msPerCandle,
  stepCursor,
  type ReplayControllerState,
  type ReplaySpeedMultiplier,
} from '@/features/backtest-replay/replay-window'

type LoadState =
  | { status: 'idle' | 'loading'; availability: null }
  | { status: 'ready'; availability: Extract<ReplayAvailability, { available: true }> }
  | { status: 'unavailable'; availability: Extract<ReplayAvailability, { available: false }> }
  | { status: 'error'; message: string; availability: null }

const CONTEXT_BARS = 60

function EmptyMessage({ title, message }: { title: string; message: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="space-y-4 py-8 text-center">
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="mt-2 text-xs text-muted-foreground">{message}</p>
        </div>
        <Link to="/backtest-replay">
          <Button className="min-h-11">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Backtest Replay
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}

function LoadingPage() {
  return (
    <div className="min-w-0 space-y-4">
      <Skeleton className="h-12 rounded-xl" />
      <Skeleton className="h-[260px] rounded-xl" />
      <Skeleton className="h-28 rounded-xl" />
    </div>
  )
}

function clampIndex(index: number, count: number): number {
  return Math.max(0, Math.min(Math.max(0, count - 1), index))
}

export function CandleResearchPage() {
  const [searchParams] = useSearchParams()
  const backtestId = searchParams.get('backtest') ?? searchParams.get('id') ?? ''
  const [loadState, setLoadState] = useState<LoadState>({ status: 'idle', availability: null })
  const [selectedSetupIndex, setSelectedSetupIndex] = useState(0)
  const [jumpValue, setJumpValue] = useState('1')
  const [showThresholdOverlays, setShowThresholdOverlays] = useState(true)
  const [reviewVersion, setReviewVersion] = useState(0)
  const [replayState, setReplayState] = useState<ReplayControllerState>(() =>
    createInitialReplayState(0, true),
  )

  useEffect(() => {
    if (!backtestId) {
      setLoadState({ status: 'idle', availability: null })
      return
    }

    let cancelled = false
    setLoadState({ status: 'loading', availability: null })

    void loadBacktestReplay(backtestId)
      .then((availability) => {
        if (cancelled) return
        if (availability.available) {
          setLoadState({ status: 'ready', availability })
          setSelectedSetupIndex(0)
          setJumpValue('1')
          setReplayState(createInitialReplayState(availability.bundle.candles.length, true))
          setReviewVersion((v) => v + 1)
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
  }, [backtestId])

  const bundle = loadState.status === 'ready' ? loadState.availability.bundle : null

  const { features, setups } = useMemo(() => {
    if (!bundle) return { features: [], setups: [] }
    const nextFeatures = extractCandleFeatures(bundle.candles)
    const nextSetups = detectDirectConsumptionSetups(nextFeatures)
    return {
      features: nextFeatures,
      setups: nextSetups,
    }
  }, [bundle])

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

  useEffect(() => {
    setJumpValue(String(selectedSetupIndex + 1))
  }, [selectedSetupIndex])

  const visibleCandles = useMemo(() => {
    if (!bundle) return []
    return replayState.mode === 'replay'
      ? candlesVisibleForReplay(bundle.candles, replayState.cursorIndex)
      : bundle.candles
  }, [bundle, replayState.cursorIndex, replayState.mode])

  const selectedSetup = setups[selectedSetupIndex] ?? null

  const chartWindow = useMemo(() => {
    if (!bundle || visibleCandles.length === 0) return []
    if (!selectedSetup) {
      const end = visibleCandles.length - 1
      const start = Math.max(0, end - 120)
      return visibleCandles.slice(start, end + 1)
    }

    const center = selectedSetup.candleIndex
    const start = Math.max(0, center - CONTEXT_BARS)
    const end = Math.min(visibleCandles.length - 1, center + CONTEXT_BARS)
    return visibleCandles.slice(start, end + 1)
  }, [bundle, selectedSetup, visibleCandles])

  const selectedFeature = selectedSetup ? features[selectedSetup.candleIndex] : null

  const reviewBySetupId = useMemo(() => {
    if (!backtestId) return new Map<string, ResearchReviewVerdict>()
    const map = new Map<string, ResearchReviewVerdict>()
    for (const review of listCandleResearchReviews(backtestId)) {
      map.set(review.setupId, review.verdict)
    }
    return map
  }, [backtestId, reviewVersion])

  const selectedVerdict = selectedSetup ? reviewBySetupId.get(selectedSetup.id) ?? null : null

  const overlayLevels = useMemo(() => {
    if (!showThresholdOverlays || !selectedSetup || !selectedFeature?.previous) return []

    const previous = selectedFeature.previous
    const bodySize = Math.abs(previous.close - previous.open)
    if (bodySize <= 0) return []

    return DIRECT_CONSUMPTION_THRESHOLDS.map((threshold) => {
      const price =
        selectedSetup.referenceType === 'BULLISH_REFERENCE'
          ? previous.close - bodySize * threshold
          : previous.close + bodySize * threshold
      return {
        price,
        label: `${Math.round(threshold * 100)}%`,
        color: '#38bdf8',
      }
    })
  }, [selectedFeature?.previous, selectedSetup, showThresholdOverlays])

  const reviewedCount = useMemo(() => {
    if (!setups.length) return 0
    return setups.filter((setup) => reviewBySetupId.has(setup.id)).length
  }, [reviewBySetupId, setups])

  const applyVerdict = (verdict: ResearchReviewVerdict) => {
    if (!selectedSetup || !backtestId) return

    if (selectedVerdict === verdict) {
      clearCandleResearchReview(backtestId, selectedSetup.id)
    } else {
      saveCandleResearchReview({
        backtestId,
        setupId: selectedSetup.id,
        hypothesis: selectedSetup.hypothesis,
        verdict,
      })
    }

    setReviewVersion((value) => value + 1)
  }

  const selectSetup = (index: number) => {
    const next = clampIndex(index, setups.length)
    setSelectedSetupIndex(next)
    setReplayState((current) => ({
      ...current,
      cursorIndex: Math.max(0, (setups[next]?.candleIndex ?? 1) - 1),
      mode: 'full',
      playing: false,
    }))
  }

  if (!backtestId) {
    return (
      <EmptyMessage
        title="Candle Research needs a backtest id"
        message="Open this page with ?backtest=<id> from a completed replay session."
      />
    )
  }

  if (loadState.status === 'idle' || loadState.status === 'loading') return <LoadingPage />

  if (loadState.status === 'unavailable') {
    return <EmptyMessage title="Replay unavailable" message={loadState.availability.message} />
  }

  if (loadState.status === 'error') {
    return <EmptyMessage title="Candle Research failed to load" message={loadState.message} />
  }

  if (!bundle) {
    return (
      <EmptyMessage
        title="Replay unavailable"
        message="Replay data could not be loaded for this backtest."
      />
    )
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            to={`/backtest-replay?backtest=${encodeURIComponent(backtestId)}`}
            className="inline-flex min-h-11 items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Backtest Replay
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground">Candle Research · Phase 1</h1>
            <Badge variant="outline" className="font-mono">
              {bundle.metadata.symbol}
            </Badge>
            <Badge variant="outline" className="font-mono">
              {bundle.metadata.timeframe}
            </Badge>
            <Badge variant="outline">Direct Consumption</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {setups.length} setups detected · {reviewedCount} reviewed
          </p>
        </div>
      </div>

      <Card glow>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Setup Chart</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Reuses replay chart with reference-candle highlight and threshold overlays.
              </p>
            </div>
            <label className="inline-flex min-h-11 items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={showThresholdOverlays}
                onChange={(event) => setShowThresholdOverlays(event.target.checked)}
              />
              Show 40/50/60/70/80 overlays
            </label>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <ReplayCandlestickChart
            candles={chartWindow}
            markers={[]}
            selectedTradeId={null}
            visibleEntryMarkers={[]}
            visibleExitMarkers={[]}
            highlightedCandleTimes={selectedSetup ? [selectedSetup.referenceCandleTime] : []}
            overlayLevels={overlayLevels}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Setup Navigator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="flex items-center justify-between gap-3 text-xs">
            <p className="text-muted-foreground">Setup count</p>
            <p className="font-mono text-foreground">
              {setups.length === 0 ? '0 / 0' : `${selectedSetupIndex + 1} / ${setups.length}`}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={setups.length === 0 || selectedSetupIndex <= 0}
              onClick={() => selectSetup(0)}
            >
              First Setup
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={setups.length === 0 || selectedSetupIndex <= 0}
              onClick={() => selectSetup(selectedSetupIndex - 1)}
            >
              Previous Setup
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={setups.length === 0 || selectedSetupIndex >= setups.length - 1}
              onClick={() => selectSetup(selectedSetupIndex + 1)}
            >
              Next Setup
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={setups.length === 0 || selectedSetupIndex >= setups.length - 1}
              onClick={() => selectSetup(setups.length - 1)}
            >
              Last Setup
            </Button>
          </div>

          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              const parsed = Number(jumpValue)
              if (!Number.isFinite(parsed)) return
              selectSetup(Math.trunc(parsed) - 1)
            }}
          >
            <label className="min-w-0 flex-1">
              <span className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
                Jump to Setup
              </span>
              <Input
                type="number"
                min={1}
                max={Math.max(1, setups.length)}
                inputMode="numeric"
                value={jumpValue}
                disabled={setups.length === 0}
                onChange={(event) => setJumpValue(event.target.value)}
                className="min-h-11 font-mono text-xs"
              />
            </label>
            <Button type="submit" className="min-h-11 shrink-0" disabled={setups.length === 0}>
              Jump
            </Button>
          </form>
        </CardContent>
      </Card>

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
        onStep={(steps) => setReplayState((current) => stepCursor(current, bundle.candles.length, steps))}
        onSpeedChange={(speed: ReplaySpeedMultiplier) =>
          setReplayState((current) => ({ ...current, speed }))
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Selected Setup Review</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {selectedSetup ? (
            <>
              <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                <div>
                  <p className="text-muted-foreground">Reference</p>
                  <p className="font-mono text-foreground">{selectedSetup.referenceType}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Penetration</p>
                  <p className="font-mono text-foreground">{Math.round(selectedSetup.penetrationDepth * 100)}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Thresholds hit</p>
                  <p className="font-mono text-foreground">
                    {selectedSetup.penetrationThresholdsHit.map((value) => Math.round(value * 100)).join(', ')}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Current verdict</p>
                  <p className="font-mono text-foreground">{selectedVerdict ?? 'unreviewed'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Button
                  type="button"
                  variant={selectedVerdict === 'correct' ? 'default' : 'outline'}
                  className="min-h-11"
                  onClick={() => applyVerdict('correct')}
                >
                  Correct
                </Button>
                <Button
                  type="button"
                  variant={selectedVerdict === 'wrong' ? 'default' : 'outline'}
                  className="min-h-11"
                  onClick={() => applyVerdict('wrong')}
                >
                  Wrong
                </Button>
                <Button
                  type="button"
                  variant={selectedVerdict === 'unclear' ? 'default' : 'outline'}
                  className="min-h-11"
                  onClick={() => applyVerdict('unclear')}
                >
                  Unclear
                </Button>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No setups detected in this replay dataset.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
