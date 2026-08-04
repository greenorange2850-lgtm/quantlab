import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type {
  SetupReviewVerdict,
  TradingSetup,
} from '@/core/setup'

function CheckList({
  title,
  checks,
}: {
  title: string
  checks: TradingSetup['requiredChecks']
}) {
  if (checks.length === 0) return null
  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="space-y-1">
        {checks.map((c) => (
          <li
            key={`${title}-${c.name}`}
            className="flex items-start justify-between gap-2 text-[11px]"
          >
            <span>
              <span className={c.passed ? 'text-emerald-300' : 'text-red-300'}>
                {c.passed ? '✓' : '✗'}
              </span>{' '}
              {c.name}
              {c.required ? '' : ' (opt)'}
            </span>
            <span className="max-w-[55%] text-right font-mono text-[10px] text-muted-foreground">
              {c.reason}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

interface SetupInspectorProps {
  setup: TradingSetup | null
  note: string
  onNoteChange: (v: string) => void
  verdict: SetupReviewVerdict | null
  onVerdict: (v: SetupReviewVerdict) => void
  onResetReview: () => void
  onClear?: () => void
}

export function SetupInspector({
  setup,
  note,
  onNoteChange,
  verdict,
  onVerdict,
  onResetReview,
  onClear,
}: SetupInspectorProps) {
  if (!setup) {
    return (
      <Card hover={false}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Setup Inspector</CardTitle>
        </CardHeader>
        <CardContent className="text-[11px] text-muted-foreground">
          Select a setup to inspect checks, entry, and reason chain.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card hover={false}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm">Setup Inspector</CardTitle>
          {onClear ? (
            <Button type="button" size="sm" variant="ghost" onClick={onClear}>
              Clear
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{setup.setupType}</Badge>
          <Badge variant="outline">{setup.status}</Badge>
          <Badge variant="outline">{setup.direction}</Badge>
          <span className="font-mono text-muted-foreground">
            Strength {setup.strength.score}
          </span>
        </div>

        <p className="text-[11px] text-muted-foreground">{setup.reason}</p>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Trend</p>
            <p className="font-mono">{setup.trendContext}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Entry</p>
            <p className="font-mono">
              {setup.entryZone
                ? `${setup.entryZone.low.toFixed(2)} – ${setup.entryZone.high.toFixed(2)} (${setup.entryZone.sourceKind})`
                : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Stop</p>
            <p className="font-mono">
              {setup.stopReference ? setup.stopReference.level.toFixed(2) : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Target</p>
            <p className="font-mono">
              {setup.suggestedTarget != null ? setup.suggestedTarget.toFixed(2) : '—'}
            </p>
          </div>
        </div>

        <CheckList title="Required Checks" checks={setup.requiredChecks} />
        <CheckList title="Optional Checks" checks={setup.optionalChecks} />

        {setup.missingChecks.length > 0 ? (
          <div>
            <p className="mb-1 text-[10px] uppercase text-muted-foreground">Missing Checks</p>
            <p className="text-[11px] text-amber-100">{setup.missingChecks.join(', ')}</p>
          </div>
        ) : null}

        {setup.warnings.length > 0 ? (
          <div>
            <p className="mb-1 text-[10px] uppercase text-muted-foreground">Warnings</p>
            <ul className="list-inside list-disc text-[11px] text-amber-100/90">
              {setup.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div>
          <p className="mb-1 text-[10px] uppercase text-muted-foreground">Reason Chain</p>
          <ul className="space-y-0.5 font-mono text-[10px] text-muted-foreground">
            {setup.strength.reasons.slice(0, 12).map((r) => (
              <li key={r.id}>
                {r.label}: {r.reason}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-1 text-[10px] uppercase text-muted-foreground">Referenced Events</p>
          <ul className="space-y-0.5 font-mono text-[10px] text-muted-foreground">
            {setup.eventChain.map((e) => (
              <li key={`${e.role}-${e.id}`}>
                {e.role}: {e.kind} · {e.id}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2 border-t border-border pt-2">
          <p className="text-[10px] uppercase text-muted-foreground">Manual Validation</p>
          <textarea
            className="min-h-[64px] w-full rounded-lg border border-border bg-white/[0.03] px-2 py-1.5 text-[11px]"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Review note"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={verdict === 'correct' ? 'default' : 'secondary'}
              onClick={() => onVerdict('correct')}
            >
              Correct
            </Button>
            <Button
              type="button"
              size="sm"
              variant={verdict === 'wrong' ? 'default' : 'secondary'}
              onClick={() => onVerdict('wrong')}
            >
              Wrong
            </Button>
            <Button
              type="button"
              size="sm"
              variant={verdict === 'unsure' ? 'default' : 'outline'}
              onClick={() => onVerdict('unsure')}
            >
              Unsure
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onResetReview}>
              Reset
            </Button>
          </div>
          {verdict ? (
            <p className="text-[10px] text-muted-foreground">Last verdict: {verdict}</p>
          ) : null}
        </div>

        <div className="text-[10px] text-muted-foreground">
          {setup.riskNotes.join(' · ')}
        </div>
      </CardContent>
    </Card>
  )
}
