import { Activity, Compass, HeartPulse, Lightbulb } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MetricTile } from '@/features/research-analysis/components/MetricTile'
import { KPI_SECONDARY_GRID } from '@/layouts/layout-classes'
import { cn } from '@/lib/utils'
import {
  formatCountOrDash,
  formatPhaseStatusLabel,
  formatScoreOrDash,
  type OptimizerTransparencySnapshot,
  type ResearchHealthLabel,
  type ResearchHealthSnapshot,
  type ResearchProgressSnapshot,
  type ResearchRecommendation,
  type ResearchPhaseStatus,
} from '../research-intelligence'

function statusTone(status: ResearchPhaseStatus): string {
  switch (status) {
    case 'improving':
      return 'border-success/30 bg-success/10 text-success'
    case 'exploring':
      return 'border-accent/30 bg-accent/10 text-accent'
    case 'plateauing':
      return 'border-warning/30 bg-warning/10 text-warning'
    case 'converged':
      return 'border-border bg-white/[0.04] text-muted-foreground'
  }
}

function healthTone(rating: ResearchHealthLabel): 'positive' | 'warning' | 'negative' | 'default' {
  switch (rating) {
    case 'Excellent':
      return 'positive'
    case 'Good':
      return 'default'
    case 'Fair':
      return 'warning'
    case 'Poor':
      return 'negative'
  }
}

interface ResearchProgressPanelProps {
  snapshot: ResearchProgressSnapshot
}

export function ResearchProgressPanel({ snapshot }: ResearchProgressPanelProps) {
  return (
    <Card hover={false}>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Research Progress</CardTitle>
        </div>
        <Badge
          variant="outline"
          className={cn('w-fit text-[10px]', statusTone(snapshot.status))}
        >
          {formatPhaseStatusLabel(snapshot.status)}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className={KPI_SECONDARY_GRID}>
          <MetricTile
            label="Candidates Tested"
            value={formatCountOrDash(snapshot.candidatesTested)}
            size="secondary"
          />
          <MetricTile
            label="Accepted"
            value={formatCountOrDash(snapshot.accepted)}
            size="secondary"
            tone={snapshot.accepted === 0 ? 'warning' : 'default'}
          />
          <MetricTile
            label="Rejected"
            value={formatCountOrDash(snapshot.rejected)}
            size="secondary"
            tone="muted"
          />
          <MetricTile
            label="Current Best Score"
            value={formatScoreOrDash(snapshot.currentBestScore)}
            size="secondary"
          />
          <MetricTile
            label="Best Candidate Trades"
            value={formatCountOrDash(snapshot.bestTradeCount)}
            hint="Trade count of the current best candidate"
            size="secondary"
          />
          <MetricTile
            label="Last Improvement"
            value={
              snapshot.lastImprovementAgo === null
                ? '—'
                : `${snapshot.lastImprovementAgo} ago`
            }
            hint="Candidates since last best"
            size="secondary"
            tone="muted"
          />
        </div>
      </CardContent>
    </Card>
  )
}

interface ResearchHealthPanelProps {
  snapshot: ResearchHealthSnapshot
}

export function ResearchHealthPanel({ snapshot }: ResearchHealthPanelProps) {
  return (
    <Card hover={false}>
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Research Health</CardTitle>
        </div>
        <Badge
          variant="outline"
          className={cn(
            'w-fit text-[10px]',
            snapshot.rating === 'Excellent' && 'border-success/30 bg-success/10 text-success',
            snapshot.rating === 'Poor' && 'border-danger/30 bg-danger/10 text-danger',
            snapshot.rating === 'Fair' && 'border-warning/30 bg-warning/10 text-warning',
          )}
        >
          {snapshot.rating}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <MetricTile
          label="Rating"
          value={snapshot.rating}
          hint="Mapped from existing research rating — no new score"
          tone={healthTone(snapshot.rating)}
          size="primary"
        />
        <ul className="space-y-1.5">
          {snapshot.reasons.map((reason) => (
            <li
              key={reason}
              className="flex items-start gap-2 text-sm text-foreground/90"
            >
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
              <span className="text-pretty">{reason}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

interface NextRecommendationPanelProps {
  recommendation: ResearchRecommendation
}

export function NextRecommendationPanel({ recommendation }: NextRecommendationPanelProps) {
  return (
    <Card hover={false}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Next Recommendation</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm font-medium">{recommendation.title}</p>
        <p className="text-pretty text-sm text-muted-foreground">{recommendation.detail}</p>
        <p className="text-[11px] text-muted-foreground">Rule-based guidance from search progress only.</p>
      </CardContent>
    </Card>
  )
}

interface OptimizerTransparencyPanelProps {
  snapshot: OptimizerTransparencySnapshot
}

export function OptimizerTransparencyPanel({ snapshot }: OptimizerTransparencyPanelProps) {
  return (
    <Card hover={false}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Optimizer Transparency</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-4">
          <MetricTile
            label="Candidates Generated"
            value={formatCountOrDash(snapshot.candidatesGenerated)}
            size="secondary"
          />
          <MetricTile
            label="Passed Filters"
            value={formatCountOrDash(snapshot.passedFilters)}
            size="secondary"
          />
          <MetricTile
            label="Rejected"
            value={formatCountOrDash(snapshot.rejected)}
            size="secondary"
            tone="muted"
          />
          <MetricTile
            label="Current Best"
            value={formatScoreOrDash(snapshot.currentBest)}
            size="secondary"
          />
        </div>
      </CardContent>
    </Card>
  )
}
