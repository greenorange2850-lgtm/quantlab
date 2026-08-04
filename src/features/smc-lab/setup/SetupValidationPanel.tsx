import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SetupReviewRecord, SetupValidationMetrics } from '@/core/setup'

function pct(value: number | null): string {
  if (value == null) return 'n/a'
  return `${(value * 100).toFixed(1)}%`
}

interface SetupValidationPanelProps {
  metrics: SetupValidationMetrics | null
  reviews: readonly SetupReviewRecord[]
}

export function SetupValidationPanel({ metrics, reviews }: SetupValidationPanelProps) {
  return (
    <Card hover={false}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Setup Validation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-[11px]">
        <p className="text-muted-foreground">
          Manual Correct / Wrong / Unsure reviews on setups. Metrics use reviewed samples only.
        </p>
        {metrics ? (
          <>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Reviewed {metrics.reviewedCount}</Badge>
              <Badge variant="outline">Correct {metrics.correctCount}</Badge>
              <Badge variant="outline">Wrong {metrics.wrongCount}</Badge>
              <Badge variant="outline">Unsure {metrics.unsureCount}</Badge>
            </div>
            <div className="flex flex-wrap gap-3 font-mono text-muted-foreground">
              <span>Precision {pct(metrics.precision)}</span>
              <span>Recall {pct(metrics.recall)}</span>
              <span>Agreement {pct(metrics.agreement)}</span>
              <span>False Ready {metrics.falseReady}</span>
              <span>False Reject {metrics.falseReject}</span>
            </div>
          </>
        ) : (
          <p className="text-muted-foreground">No setup reviews yet.</p>
        )}
        {reviews.length > 0 ? (
          <ul className="max-h-40 space-y-1 overflow-y-auto font-mono text-[10px] text-muted-foreground">
            {reviews
              .slice()
              .reverse()
              .map((r) => (
                <li key={`${r.setupId}-${r.reviewedAt}`}>
                  {r.verdict} · {r.setupType} · {r.statusAtReview} · {r.setupId}
                </li>
              ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  )
}
