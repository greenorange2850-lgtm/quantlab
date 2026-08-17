import { motion } from 'framer-motion'
import { ArrowDown, ArrowUp, Crosshair, Minus, ShieldAlert, Target } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Disclosure } from '@/components/ui/disclosure'
import { Progress } from '@/components/ui/progress'
import type {
  PlaybookAction,
  PlaybookEvaluation,
  PlaybookStatus,
} from '@/core/playbook'
import { STATUS_LABELS } from '@/core/playbook'
import { cn } from '@/lib/utils'

const ACTION_META: Record<PlaybookAction, { label: string; variant: 'success' | 'danger' | 'warning' | 'outline' }> = {
  BUY: { label: 'BUY', variant: 'success' },
  SELL: { label: 'SELL', variant: 'danger' },
  WAIT: { label: 'WAIT', variant: 'warning' },
  NO_TRADE: { label: 'NO TRADE', variant: 'outline' },
}

const STATUS_VARIANT: Record<PlaybookStatus, 'success' | 'danger' | 'warning' | 'accent' | 'outline'> = {
  READY: 'success',
  WATCHING: 'outline',
  WAITING_RETEST: 'warning',
  INVALIDATED: 'danger',
  COMPLETED: 'accent',
  EXPIRED: 'warning',
}

interface DecisionCardProps {
  evaluation: PlaybookEvaluation
}

export function DecisionCard({ evaluation }: DecisionCardProps) {
  const action = ACTION_META[evaluation.action]
  const DirectionIcon =
    evaluation.direction === 'long' ? ArrowUp : evaluation.direction === 'short' ? ArrowDown : Minus

  return (
    <Card glow className="overflow-hidden">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <CardTitle>{evaluation.direction === 'long' ? 'Long' : evaluation.direction === 'short' ? 'Short' : 'Neutral'} setup</CardTitle>
            <Badge variant={STATUS_VARIANT[evaluation.status]}>{STATUS_LABELS[evaluation.status]}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {evaluation.symbol} · {evaluation.timeframe} · candle {evaluation.candleIndex}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Strength</div>
            <div className="text-lg font-semibold text-foreground">{evaluation.strength}</div>
          </div>
          <Badge
            variant={action.variant}
            className={cn('gap-1 px-3 py-1 text-sm font-bold tracking-wide')}
          >
            <DirectionIcon className="h-4 w-4" />
            {action.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Progress value={evaluation.strength} />
          </div>
          <span className="text-xs text-muted-foreground">
            {evaluation.strength >= 60 ? 'Actionable' : 'Below threshold'}
          </span>
        </div>

        {evaluation.explanation && (
          <p className="rounded-lg border border-border/60 bg-white/[0.02] px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {evaluation.explanation}
          </p>
        )}

        {(evaluation.entryZone || evaluation.stopReference || evaluation.targets.length > 0) && (
          <div className="grid gap-3 sm:grid-cols-3">
            {evaluation.entryZone && (
              <div className="rounded-lg border border-border/60 bg-white/[0.02] p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Crosshair className="h-3 w-3" /> Entry zone
                </div>
                <div className="mt-1 font-mono text-sm text-foreground">
                  {evaluation.entryZone.zone.bottom.toFixed(2)} – {evaluation.entryZone.zone.top.toFixed(2)}
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">{evaluation.entryZone.label}</div>
              </div>
            )}
            {evaluation.stopReference && (
              <div className="rounded-lg border border-border/60 bg-white/[0.02] p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <ShieldAlert className="h-3 w-3" /> Stop
                </div>
                <div className="mt-1 font-mono text-sm text-foreground">
                  {evaluation.stopReference.price.toFixed(2)}
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">{evaluation.stopReference.label}</div>
              </div>
            )}
            {evaluation.targets.length > 0 && (
              <div className="rounded-lg border border-border/60 bg-white/[0.02] p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Target className="h-3 w-3" /> Targets
                </div>
                <div className="mt-1 space-y-0.5">
                  {evaluation.targets.map((t) => (
                    <div key={t.order} className="flex items-center justify-between font-mono text-sm text-foreground">
                      <span className="text-[10px] text-muted-foreground">T{t.order}</span>
                      <span>{t.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">RR {evaluation.parameters['rr']}</div>
              </div>
            )}
          </div>
        )}

        <Disclosure title="Setup checks" defaultOpen>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {evaluation.checks.map((check) => (
              <div
                key={check.id}
                className="flex items-center gap-2 rounded-md border border-border/50 bg-white/[0.02] px-2.5 py-1.5"
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    check.passed ? 'bg-success' : 'bg-muted-foreground/50',
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {check.label}
                </span>
                {check.required && (
                  <span className="shrink-0 text-[9px] uppercase tracking-wider text-muted-foreground/70">
                    req
                  </span>
                )}
              </div>
            ))}
          </div>
        </Disclosure>

        {evaluation.eventChain.length > 0 && (
          <Disclosure title={`Event chain (${evaluation.eventChain.length})`}>
            <ol className="space-y-2">
              {evaluation.eventChain.map((link, i) => (
                <li key={i} className="flex items-center gap-2 text-xs">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/5 text-[10px] text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{link.label}</span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70">
                    {new Date(link.timestamp).toLocaleDateString()} {link.candleIndex}
                  </span>
                </li>
              ))}
            </ol>
          </Disclosure>
        )}

        {evaluation.nextExpectedEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-start gap-2 rounded-lg border border-accent/20 bg-accent/5 px-3 py-2"
          >
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-accent-foreground">Next</div>
              <div className="text-xs text-foreground">{evaluation.nextExpectedEvent.label}</div>
              {evaluation.nextExpectedEvent.detail && (
                <div className="mt-0.5 text-[11px] text-muted-foreground">
                  {evaluation.nextExpectedEvent.detail}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {evaluation.warnings.length > 0 && (
          <div className="space-y-1">
            {evaluation.warnings.map((w) => (
              <p key={w} className="text-[11px] text-warning">
                {w}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
