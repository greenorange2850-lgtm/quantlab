import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Disclosure } from '@/components/ui/disclosure'
import { MetricTile } from '@/features/research-analysis/components/MetricTile'
import { KPI_SECONDARY_GRID } from '@/layouts/layout-classes'
import { formatCurrency, formatPercent, cn } from '@/lib/utils'
import type {
  OptimizationResultSummary,
  ResearchReport,
} from '@/core/research'
import { resolveOptimizationSummary } from './resolve-optimization-summary'

function verdictTone(verdict: OptimizationResultSummary['verdict']): string {
  switch (verdict) {
    case 'Meaningfully Improved':
      return 'border-success/30 bg-success/10 text-success'
    case 'Improved but Unstable':
      return 'border-warning/30 bg-warning/10 text-warning'
    case 'No Meaningful Improvement':
    case 'Constraints Not Met':
      return 'border-danger/30 bg-danger/10 text-danger'
    case 'Insufficient Evidence':
      return 'border-border bg-white/[0.04] text-muted-foreground'
  }
}

function stabilityTone(level: string): string {
  if (level === 'HIGH') return 'text-success'
  if (level === 'MEDIUM') return 'text-warning'
  if (level === 'LOW') return 'text-danger'
  return 'text-muted-foreground'
}

/** Presentation-only score delta from persisted baseline / recommended scores. */
function formatScoreImprovement(
  baselineScore: number | null | undefined,
  recommendedScore: number | null | undefined,
): string {
  if (
    baselineScore === null ||
    baselineScore === undefined ||
    recommendedScore === null ||
    recommendedScore === undefined ||
    !Number.isFinite(baselineScore) ||
    !Number.isFinite(recommendedScore)
  ) {
    return '—'
  }
  const delta = recommendedScore - baselineScore
  const sign = delta > 0 ? '+' : ''
  if (Math.abs(baselineScore) < 1e-9) {
    return `${sign}${delta.toFixed(2)}`
  }
  const pct = (delta / Math.abs(baselineScore)) * 100
  return `${sign}${delta.toFixed(2)} (${sign}${pct.toFixed(1)}%)`
}

interface OptimizationResultPanelProps {
  report: ResearchReport
  /** When omitted, resolved from persisted report.optimization / baseline. */
  optimization?: OptimizationResultSummary
}

export function OptimizationResultPanel({
  report,
  optimization: optimizationProp,
}: OptimizationResultPanelProps) {
  const optimization = optimizationProp ?? resolveOptimizationSummary(report)
  if (!optimization) return null

  const baseline = optimization.baseline
  const recommended = report.recommendedCandidate ?? report.bestCandidate
  const rawBest = report.rawBestCandidate
  const legacy = (optimization.schemaVersion ?? 0) < 1 && !baseline

  if (legacy) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Optimization Result</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Adaptive baseline / stability data is unavailable for this legacy session.
          Showing packaged research analysis only.
        </CardContent>
      </Card>
    )
  }

  const baselineScore = baseline?.score ?? null
  const recommendedScore = recommended?.score ?? null
  const rawBestScore = rawBest?.score ?? null

  return (
    <Card className="border-accent/20">
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Optimization Result</CardTitle>
          <Badge variant="outline" className={cn('w-fit text-[10px]', verdictTone(optimization.verdict))}>
            {optimization.verdict}
          </Badge>
        </div>
        <p className="text-pretty text-xs text-muted-foreground">{optimization.verdictDetail}</p>
        {optimization.stabilityIncomplete && (
          <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
            Partial Optimization Result — stability analysis was incomplete. Treat the current best as
            provisional.
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        <div className={KPI_SECONDARY_GRID}>
          <MetricTile
            label="Baseline Score"
            value={baselineScore === null ? '—' : baselineScore.toFixed(2)}
            size="secondary"
          />
          <MetricTile
            label="Raw Best Score"
            value={rawBestScore === null ? '—' : rawBestScore.toFixed(2)}
            size="secondary"
          />
          <MetricTile
            label="Recommended Score"
            value={recommendedScore === null ? '—' : recommendedScore.toFixed(2)}
            size="secondary"
          />
          <MetricTile
            label="Improvement"
            value={formatScoreImprovement(baselineScore, recommendedScore)}
            size="secondary"
            tone={
              baselineScore !== null &&
              recommendedScore !== null &&
              recommendedScore > baselineScore
                ? 'positive'
                : 'muted'
            }
          />
          <MetricTile
            label="Stability"
            value={optimization.stability?.overall ?? 'Unavailable'}
            size="secondary"
          />
          <MetricTile label="Validation" value="Required" size="secondary" tone="warning" />
        </div>

        <div className="rounded-lg border border-border/60 bg-white/[0.02] px-3 py-3 text-xs">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Next recommendation
          </p>
          <p className="mt-1 text-pretty text-muted-foreground">
            {optimization.recommendation.explanation || optimization.verdictDetail}
          </p>
        </div>

        <BestScoreTimeline optimization={optimization} />

        {baseline && recommended && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <CandidateCompareCard
              title="Baseline"
              params={baseline.parameters}
              summary={baseline}
              score={baseline.score}
            />
            <CandidateCompareCard
              title="Recommended"
              params={recommended.parameters}
              summary={recommended.report.summary}
              score={recommended.score}
              highlight
            />
          </div>
        )}

        {rawBest && recommended && rawBest.id !== recommended.id && (
          <p className="text-xs text-muted-foreground">
            Raw best ({rawBest.score.toFixed(2)}) differs from recommended (
            {recommended.score.toFixed(2)}): {optimization.recommendation.explanation}
          </p>
        )}

        <Disclosure title="What improved">
          <ul className="space-y-1 text-xs text-muted-foreground">
            {optimization.metricChanges.length === 0 ? (
              <li>No persisted metric comparison available.</li>
            ) : (
              optimization.metricChanges.map((change) => (
                <li
                  key={change.key}
                  className={change.improved === false ? 'text-warning' : undefined}
                >
                  {change.text}
                </li>
              ))
            )}
          </ul>
        </Disclosure>

        <Disclosure title="Parameter changes">
          <ul className="space-y-1 font-mono text-xs">
            {optimization.parameterChanges.length === 0 ? (
              <li className="font-sans text-muted-foreground">No parameter changes recorded.</li>
            ) : (
              optimization.parameterChanges.map((change) => (
                <li key={change.name}>
                  {change.label}: {change.before} → {change.after}
                </li>
              ))
            )}
          </ul>
        </Disclosure>

        <Disclosure title="Stability & search explanation" defaultOpen>
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>
              Stages: {optimization.searchExplanation.stagesCompleted.join(' → ') || '—'}
            </p>
            <p>
              Evaluated {optimization.searchExplanation.candidatesEvaluated} · Unique{' '}
              {optimization.searchExplanation.uniqueCandidates} · Duplicates skipped{' '}
              {optimization.searchExplanation.duplicatesSkipped} (
              {(optimization.searchExplanation.duplicateRate * 100).toFixed(0)}%)
            </p>
            <p>Improvements: {optimization.searchExplanation.improvementCount}</p>
            {optimization.plateau?.detected ? (
              <p>
                Plateau / convergence: {optimization.plateau.detail}
                {optimization.plateau.continued ? ' Search continued after detection.' : ''}
              </p>
            ) : optimization.searchExplanation.plateauDetail ? (
              <p>Plateau: {optimization.searchExplanation.plateauDetail}</p>
            ) : (
              <p>Plateau / convergence: none detected (or not recorded).</p>
            )}
            {optimization.stability ? (
              <div className="space-y-1 pt-2">
                <p className={stabilityTone(optimization.stability.overall)}>
                  Parameter Stability: {optimization.stability.overall}
                </p>
                <p>{optimization.stability.summary}</p>
                {optimization.stability.stableParameters.length > 0 && (
                  <p>
                    Stable:{' '}
                    {optimization.stability.stableParameters
                      .map((p) => `${p.label}${p.valueRangeLabel ? ` ${p.valueRangeLabel}` : ''}`)
                      .join(', ')}
                  </p>
                )}
                {optimization.stability.sensitiveParameters.length > 0 && (
                  <p>
                    Sensitive:{' '}
                    {optimization.stability.sensitiveParameters.map((p) => p.label).join(', ')}
                  </p>
                )}
              </div>
            ) : (
              <p>Stability: Unavailable</p>
            )}
            {Object.keys(optimization.rejectionReasonCounts).length > 0 && (
              <p>
                Rejections:{' '}
                {Object.entries(optimization.rejectionReasonCounts)
                  .map(([reason, count]) => `${reason}=${count}`)
                  .join(', ')}
              </p>
            )}
          </div>
        </Disclosure>
      </CardContent>
    </Card>
  )
}

function CandidateCompareCard({
  title,
  params,
  summary,
  score,
  highlight,
}: {
  title: string
  params: { fastPeriod: number; slowPeriod: number; rsiPeriod: number }
  summary: {
    netProfit: number
    profitFactor: number
    maxDrawdown: number
    winRate: number
    totalTrades?: number
    tradeCount?: number
    expectancy?: number
  }
  score: number
  highlight?: boolean
}) {
  const trades = summary.totalTrades ?? summary.tradeCount ?? 0
  return (
    <div
      className={cn(
        'min-w-0 space-y-2 rounded-lg border p-3 text-xs',
        highlight ? 'border-accent/40 bg-accent/5' : 'border-border/60',
      )}
    >
      <p className="text-sm font-medium">{title}</p>
      <p className="font-mono text-muted-foreground">
        fast={params.fastPeriod} · slow={params.slowPeriod} · rsi={params.rsiPeriod}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <span>Score {score.toFixed(2)}</span>
        <span>Net {formatCurrency(summary.netProfit)}</span>
        <span>PF {summary.profitFactor.toFixed(2)}</span>
        <span>DD {formatPercent(-summary.maxDrawdown * 100)}</span>
        <span>WR {formatPercent(summary.winRate * 100)}</span>
        <span>Trades {trades}</span>
        {summary.expectancy !== undefined && (
          <span>Exp {summary.expectancy.toFixed(2)}</span>
        )}
      </div>
    </div>
  )
}

function BestScoreTimeline({ optimization }: { optimization: OptimizationResultSummary }) {
  const points: Array<{ label: string; score: number }> = []
  if (optimization.baseline) {
    points.push({ label: 'Baseline', score: optimization.baseline.score })
  }
  for (const event of optimization.improvements) {
    points.push({
      label: event.stage,
      score: event.score,
    })
  }
  if (points.length < 2) return null

  const scores = points.map((p) => p.score)
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  const span = Math.max(max - min, 1e-6)
  const width = 320
  const height = 56
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * (width - 16) + 8
    const y = height - 10 - ((p.score - min) / span) * (height - 20)
    return { x, y, ...p }
  })
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x},${c.y}`).join(' ')

  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        Best Score Timeline
      </p>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-14 w-full max-w-md text-accent">
        <path d={path} fill="none" stroke="currentColor" strokeWidth="2" />
        {coords.map((c, i) => (
          <circle key={`${c.label}-${i}`} cx={c.x} cy={c.y} r="3" fill="currentColor" />
        ))}
      </svg>
      <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
        {coords.map((c, i) => (
          <span key={`${c.label}-${i}`} className="font-mono">
            {c.label} {c.score.toFixed(2)}
          </span>
        ))}
      </div>
    </div>
  )
}
