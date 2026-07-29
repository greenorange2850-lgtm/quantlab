import { Link, useSearchParams } from 'react-router-dom'
import { AlertCircle, ArrowLeftRight, RefreshCw, SlidersHorizontal } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useLatestResearchSession,
  useResearchSession,
  useResearchSessionArchiveReady,
} from '@/api/queries/research-sessions'
import { useBacktestDetail, useLatestBacktestDetail } from '@/api/queries/backtest-details'
import { buildResearchReport } from '@/core/research'
import { shouldAwaitResearchArchive } from '@/research/ui-gates'
import { useBacktestStore } from '@/stores/backtest.store'
import { useResearchStore } from '@/stores/research.store'
import {
  buildImprovementHeadline,
  buildMetricCompareRows,
  buildOverviewPairs,
  buildWhatsChangedItems,
} from './compare-metrics'
import { buildComparePair } from './resolve-compare-pair'
import { ComparisonOverview } from './components/ComparisonOverview'
import { MetricsComparison } from './components/MetricsComparison'
import { ImprovementSummary } from './components/ImprovementSummary'
import { WhatsChangedCard } from './components/WhatsChangedCard'
import { ValidationNotice } from './components/ValidationNotice'

function CompareSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-72 max-w-full rounded-lg" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-56 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </div>
  )
}

/**
 * Compare baseline BacktestReport vs optimized research candidate.
 * Presentation only — reuses existing reports, no new analytics.
 */
export function StrategyComparePage() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session')
  const candidateId = searchParams.get('candidate')
  const baselineId = searchParams.get('baseline')
  const archiveReady = useResearchSessionArchiveReady()

  const selectedCandidateId = useResearchStore((state) => state.selectedCandidateId)
  const activeReport = useBacktestStore((state) => state.report)
  const restoredId = useBacktestStore((state) => state.restoredId)
  const liveSession = useBacktestStore((state) => state.liveSession)

  const byIdQuery = useResearchSession(sessionId)
  const latestResearchQuery = useLatestResearchSession(!sessionId)
  const researchQuery = sessionId ? byIdQuery : latestResearchQuery

  const baselineDetailQuery = useBacktestDetail(baselineId)
  const latestBacktestQuery = useLatestBacktestDetail(!baselineId)

  const entry = researchQuery.data
  const researchReport = entry ? buildResearchReport(entry.session) : null

  const explicitBaseline = baselineId
    ? baselineDetailQuery.data ?? null
    : null

  const activeBacktestId =
    restoredId ??
    liveSession?.dashboard.recentBacktests[0]?.id ??
    latestBacktestQuery.data?.id ??
    null

  const pair =
    researchReport && entry
      ? buildComparePair({
          researchReport,
          selectedCandidateId,
          preferredCandidateId: candidateId,
          sessionCandidates: entry.session.candidates,
          explicitBaseline,
          activeReport: activeReport ?? latestBacktestQuery.data?.report ?? null,
          activeBacktestId,
        })
      : null

  const researchLoading = shouldAwaitResearchArchive({
    archiveReady,
    hasData: Boolean(entry),
    isPending:
      researchQuery.isLoading || researchQuery.isFetching || researchQuery.isPending,
  })
  const baselineLoading =
    Boolean(baselineId) &&
    !explicitBaseline &&
    (baselineDetailQuery.isLoading || baselineDetailQuery.isFetching)

  if (researchLoading || baselineLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4">
        <Header showOptimizerAction={false} />
        <CompareSkeleton />
      </div>
    )
  }

  if (researchQuery.isError || (baselineId && baselineDetailQuery.isError)) {
    const error =
      researchQuery.error instanceof Error
        ? researchQuery.error
        : baselineDetailQuery.error instanceof Error
          ? baselineDetailQuery.error
          : null

    return (
      <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4">
        <Header showOptimizerAction={false} />
        <Card hover={false} className="border-danger/30 bg-danger/10">
          <CardContent className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-2 text-sm text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="text-pretty">
                {error?.message ?? 'Failed to load comparison data'}
              </span>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 w-full sm:min-h-9 sm:w-auto"
              onClick={() => {
                void researchQuery.refetch()
                if (baselineId) void baselineDetailQuery.refetch()
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!researchReport || !researchReport.bestCandidate) {
    return (
      <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4">
        <Header showOptimizerAction={false} />
        <Card hover={false} className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="space-y-1">
              <p className="text-sm font-medium">No optimized candidate available.</p>
              <p className="mx-auto max-w-sm text-pretty text-xs text-muted-foreground">
                Run Random Search in the Optimizer and select a candidate to compare.
              </p>
            </div>
            <Link to="/optimizer" className="w-full sm:w-auto">
              <Button className="min-h-11 w-full sm:min-h-9 sm:w-auto">
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Open Optimizer
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!pair) {
    return (
      <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4">
        <Header showOptimizerAction={false} />
        <Card hover={false} className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="space-y-1">
              <p className="text-sm font-medium">Baseline backtest required.</p>
              <p className="mx-auto max-w-sm text-pretty text-xs text-muted-foreground">
                Run a baseline backtest in Strategy Lab, then compare it with the optimized
                candidate.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Link to="/strategy-lab" className="w-full sm:w-auto">
                <Button className="min-h-11 w-full sm:min-h-9 sm:w-auto">
                  Open Strategy Lab
                </Button>
              </Link>
              <Link to="/optimizer" className="w-full sm:w-auto">
                <Button variant="secondary" className="min-h-11 w-full sm:min-h-9 sm:w-auto">
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  Optimizer
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const overview = buildOverviewPairs(pair.baseline, pair.optimized)
  const metrics = buildMetricCompareRows(pair.baseline, pair.optimized)
  const changed = buildWhatsChangedItems(pair.baseline, pair.optimized)
  const headline = buildImprovementHeadline(pair.baseline, pair.optimized)
  const params = pair.optimizedCandidate.parameters

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 space-y-5">
      <Header
        sessionId={researchReport.sessionId}
        candidateLabel={`${params.fastPeriod}/${params.slowPeriod}/${params.rsiPeriod}`}
      />

      <ComparisonOverview pairs={overview} />
      <MetricsComparison rows={metrics} />

      <section className="space-y-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight">Comparison Insights</h3>
          <p className="text-pretty text-xs text-muted-foreground">
            Summary and change list generated from existing comparison values only — no new
            analytics.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ImprovementSummary headline={headline} />
          <WhatsChangedCard items={changed} />
        </div>
      </section>

      <ValidationNotice />
    </div>
  )
}

function Header({
  sessionId,
  candidateLabel,
  showOptimizerAction = true,
}: {
  sessionId?: string
  candidateLabel?: string
  showOptimizerAction?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-white/[0.03]">
          <ArrowLeftRight className="h-5 w-5 text-foreground" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">Strategy Compare</h2>
          <p className="text-pretty text-xs text-muted-foreground">
            Compare the baseline backtest with the selected optimized candidate.
          </p>
          {sessionId ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline" className="font-mono text-[10px]">
                {sessionId}
              </Badge>
              {candidateLabel ? (
                <Badge variant="accent" className="font-mono text-[10px]">
                  {candidateLabel}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {showOptimizerAction ? (
        <Link
          to={sessionId ? `/optimizer?session=${sessionId}` : '/optimizer'}
          className="w-full sm:w-auto"
        >
          <Button variant="secondary" className="min-h-11 w-full sm:min-h-9 sm:w-auto">
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Optimizer
          </Button>
        </Link>
      ) : null}
    </div>
  )
}
