import { Link, useSearchParams } from 'react-router-dom'
import { AlertCircle, Brain, RefreshCw, SlidersHorizontal } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useLatestResearchSession,
  useResearchSession,
} from '@/api/queries/research-sessions'
import { buildResearchReport } from '@/core/research'
import { ResearchOverview } from './components/ResearchOverview'
import { PerformanceMetrics } from './components/PerformanceMetrics'
import { SummaryCard } from './components/SummaryCard'
import { StrengthsCard } from './components/StrengthsCard'
import { WeaknessesCard } from './components/WeaknessesCard'
import { SuggestionsCard } from './components/SuggestionsCard'
import { RiskCard } from './components/RiskCard'
import { RatingCard } from './components/RatingCard'

function AnalysisSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-64 max-w-full rounded-lg" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  )
}

/**
 * Presentation workspace for ResearchReport from buildResearchReport().
 * TanStack Query owns fetch; no metric recalculation in the UI.
 */
export function ResearchAnalysisPage() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session')

  const byIdQuery = useResearchSession(sessionId)
  const latestQuery = useLatestResearchSession(!sessionId)

  const activeQuery = sessionId ? byIdQuery : latestQuery
  const entry = activeQuery.data
  const report = entry ? buildResearchReport(entry.session) : null

  if (!entry && (activeQuery.isLoading || activeQuery.isFetching)) {
    return (
      <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4">
        <Header showOptimizerAction={false} />
        <AnalysisSkeleton />
      </div>
    )
  }

  if (activeQuery.isError) {
    return (
      <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4">
        <Header showOptimizerAction={false} />
        <Card hover={false} className="border-danger/30 bg-danger/10">
          <CardContent className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-2 text-sm text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="text-pretty">
                {activeQuery.error instanceof Error
                  ? activeQuery.error.message
                  : 'Failed to load research session'}
              </span>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 w-full sm:min-h-9 sm:w-auto"
              onClick={() => void activeQuery.refetch()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4">
        <Header showOptimizerAction={false} />
        <Card hover={false} className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="space-y-1">
              <p className="text-sm font-medium">No research report available.</p>
              <p className="mx-auto max-w-sm text-pretty text-xs text-muted-foreground">
                Run Random Search to generate your first research report.
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

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 space-y-5">
      <Header
        sessionId={report.sessionId}
        objective={report.objective}
        status={report.status}
      />

      <ResearchOverview report={report} />
      <PerformanceMetrics report={report} />

      <section className="space-y-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight">Research Analysis</h3>
          <p className="text-pretty text-xs text-muted-foreground">
            Narrative packaged by <code className="text-foreground">buildResearchReport()</code>{' '}
            from existing BacktestReport fields — not marketed as a best strategy.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <SummaryCard analysis={report.analysis} />
          </div>
          <StrengthsCard analysis={report.analysis} />
          <WeaknessesCard analysis={report.analysis} />
          <SuggestionsCard analysis={report.analysis} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <RiskCard analysis={report.analysis} />
            <RatingCard analysis={report.analysis} />
          </div>
        </div>
      </section>
    </div>
  )
}

function Header({
  sessionId,
  objective,
  status,
  showOptimizerAction = true,
}: {
  sessionId?: string
  objective?: string
  status?: string
  showOptimizerAction?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-white/[0.03]">
          <Brain className="h-5 w-5 text-foreground" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">Research Analysis</h2>
          <p className="text-pretty text-xs text-muted-foreground">
            View historical research reports generated by the Optimizer.
          </p>
          {sessionId ? (
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline" className="font-mono text-[10px]">
                {sessionId}
              </Badge>
              {objective ? (
                <Badge variant="outline" className="text-[10px]">
                  {objective}
                </Badge>
              ) : null}
              {status ? (
                <Badge variant="outline" className="capitalize text-[10px]">
                  {status}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      {showOptimizerAction ? (
        <Link to="/optimizer" className="w-full sm:w-auto">
          <Button variant="secondary" className="min-h-11 w-full sm:min-h-9 sm:w-auto">
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Optimizer
          </Button>
        </Link>
      ) : null}
    </div>
  )
}
