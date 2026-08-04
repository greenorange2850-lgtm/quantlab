import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Disclosure } from '@/components/ui/disclosure'
import type { SetupReviewVerdict, TradingSetup } from '@/core/setup'
import {
  humanCheckLabel,
  humanMissingCondition,
  humanSetupStatus,
  humanSetupType,
} from '../analyze/trader-language'

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
          Select a setup to review entry, stop, target, and why it is or is not ready.
        </CardContent>
      </Card>
    )
  }

  const phase = humanSetupStatus(setup.status)
  const side = setup.direction === 'BULLISH' ? 'BUY' : 'SELL'

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
          <Badge variant="outline">{side}</Badge>
          <Badge variant="outline">{phase}</Badge>
          <Badge variant="outline">{humanSetupType(setup.setupType)}</Badge>
          <span className="font-mono text-muted-foreground">
            Confidence {setup.strength.score}%
          </span>
        </div>

        <p className="text-[11px] text-muted-foreground">{setup.reason}</p>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Market</p>
            <p>{setup.trendContext}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Entry</p>
            <p className="font-mono">
              {setup.entryZone
                ? `${setup.entryZone.low.toFixed(2)} – ${setup.entryZone.high.toFixed(2)}`
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

        <div>
          <p className="mb-1 text-[10px] uppercase text-muted-foreground">Conditions</p>
          <ul className="space-y-1">
            {[...setup.requiredChecks, ...setup.optionalChecks.filter((c) => c.passed)]
              .filter((c, i, arr) => arr.findIndex((x) => x.name === c.name) === i)
              .map((c) => (
                <li key={c.name} className="flex items-start gap-2 text-[11px]">
                  <span className={c.passed ? 'text-emerald-300' : 'text-red-300'}>
                    {c.passed ? '✓' : '✗'}
                  </span>
                  <span>{humanCheckLabel(c)}</span>
                </li>
              ))}
          </ul>
        </div>

        {setup.missingChecks.length > 0 ? (
          <div>
            <p className="mb-1 text-[10px] uppercase text-muted-foreground">
              Still waiting because
            </p>
            <ul className="space-y-1 text-[11px] text-amber-100">
              {setup.missingChecks.map((m) => (
                <li key={m} className="flex items-start gap-2">
                  <span className="text-red-300">✗</span>
                  <span>{humanMissingCondition(m)}</span>
                </li>
              ))}
            </ul>
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

        <div className="space-y-2 border-t border-border pt-2">
          <p className="text-[10px] uppercase text-muted-foreground">Manual review</p>
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

        <Disclosure title="Show technical details" variant="plain">
          <div className="space-y-2 font-mono text-[10px] text-muted-foreground">
            <p>id: {setup.id}</p>
            <p>
              type: {setup.setupType} · status: {setup.status} · direction: {setup.direction}
            </p>
            <p>
              entry source: {setup.entryZone?.sourceKind ?? '—'} ·{' '}
              {setup.entryZone?.sourceId ?? '—'}
            </p>
            <p>Reason chain</p>
            <ul className="space-y-0.5">
              {setup.strength.reasons.slice(0, 12).map((r) => (
                <li key={r.id}>
                  {r.label}: {r.reason}
                </li>
              ))}
            </ul>
            <p>Referenced events</p>
            <ul className="space-y-0.5">
              {setup.eventChain.map((e) => (
                <li key={`${e.role}-${e.id}`}>
                  {e.role}: {e.kind} · {e.id}
                </li>
              ))}
            </ul>
            <p>{setup.riskNotes.join(' · ')}</p>
          </div>
        </Disclosure>
      </CardContent>
    </Card>
  )
}
