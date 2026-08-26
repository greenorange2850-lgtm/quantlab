import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { STATUS_LABELS } from '@/core/playbook'
import type { PlaybookCheck } from '@/core/playbook'
import { cn } from '@/lib/utils'
import {
  selectedPlaybookSetupView,
  type PlaybookReplayMarker,
} from '../replay-markers'

interface SelectedPlaybookSetupCardProps {
  marker: PlaybookReplayMarker | null
  replayMode: 'full' | 'replay'
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-border/50 bg-white/[0.02] p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-1 min-w-0 break-words font-mono text-xs text-foreground">{value}</div>
    </div>
  )
}

function CheckList({ title, checks }: { title: string; checks: PlaybookCheck[] }) {
  if (checks.length === 0) return null
  return (
    <div>
      <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="space-y-1">
        {checks.map((check) => (
          <div key={check.id} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={cn('h-1.5 w-1.5 rounded-full', check.passed ? 'bg-success' : 'bg-muted-foreground/50')} />
            <span className="min-w-0 truncate">{check.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function SelectedPlaybookSetupCard({ marker, replayMode }: SelectedPlaybookSetupCardProps) {
  const view = selectedPlaybookSetupView(marker, replayMode)
  if (!view) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-xs text-muted-foreground">
          Select a Playbook setup to inspect the state visible at that candle.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div className="min-w-0">
          <CardTitle className="text-base">{view.playbookName}</CardTitle>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            {view.symbol} · {view.timeframe} · candle {view.candleIndex}
          </p>
        </div>
        <Badge
          variant={
            view.setupStatus === 'READY'
              ? 'success'
              : view.setupStatus === 'INVALIDATED'
                ? 'danger'
                : view.setupStatus === 'WAITING_RETEST'
                  ? 'warning'
                  : 'outline'
          }
          className="shrink-0"
        >
          {STATUS_LABELS[view.setupStatus]}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Timestamp" value={new Date(view.timestamp).toLocaleString()} />
          <Field label="Direction" value={view.direction} />
          <Field label="Strength" value={view.strength} />
          <Field label="Action" value={view.action} />
          <Field
            label="Stop"
            value={view.stopReference ? view.stopReference.price.toFixed(2) : '—'}
          />
          <Field label="First target" value={view.firstTarget ? view.firstTarget.price.toFixed(2) : '—'} />
        </div>

        <p className="rounded-lg border border-border/60 bg-white/[0.02] px-3 py-2 text-xs text-muted-foreground">
          {view.explanation}
        </p>

        <CheckList title="Required checks" checks={view.requiredChecks} />
        <CheckList title="Optional checks" checks={view.optionalChecks} />

        {view.lifecycleOutcome ? (
          <div className="rounded-lg border border-accent/20 bg-accent/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-accent-foreground">
              Historical outcome
            </p>
            <p className="mt-0.5 text-xs font-medium text-foreground">
              {STATUS_LABELS[view.lifecycleOutcome.status]}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {view.lifecycleOutcome.reason} — uses later price, not the setup state at this
              candle.
            </p>
          </div>
        ) : view.lifecycleOutcomeHidden ? (
          <p className="text-[11px] text-muted-foreground">
            A later lifecycle outcome exists but is hidden during replay so this candle only shows
            the setup state that was available here.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
