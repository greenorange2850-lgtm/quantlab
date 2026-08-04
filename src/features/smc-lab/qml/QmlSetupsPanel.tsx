import { useMemo, useState } from 'react'
import type { QmlPattern, QmlStatus, SmcQmlLayer } from '@/core/smc'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { filterQmlPatternsForVisibility } from './qml-setup-context'

const STATUS_FILTERS: Array<QmlStatus | 'ALL'> = [
  'ALL',
  'CANDIDATE',
  'CONFIRMED',
  'ZONE_ACTIVE',
  'RETESTED',
  'ENTRY_READY',
  'INVALIDATED',
  'EXPIRED',
]

interface QmlSetupsPanelProps {
  qml: SmcQmlLayer | null | undefined
  visibilityMode: 'focus' | 'balanced' | 'debug'
  selectedQmlId: string | null
  onSelect: (pattern: QmlPattern) => void
  enabled: boolean
}

export function QmlSetupsPanel({
  qml,
  visibilityMode,
  selectedQmlId,
  onSelect,
  enabled,
}: QmlSetupsPanelProps) {
  const [direction, setDirection] = useState<'BULLISH' | 'BEARISH'>('BULLISH')
  const [statusFilter, setStatusFilter] = useState<QmlStatus | 'ALL'>('ALL')

  const patterns = useMemo(() => {
    const all = filterQmlPatternsForVisibility(qml?.patterns ?? [], visibilityMode)
    return all
      .filter((p) => p.direction === direction)
      .filter((p) => (statusFilter === 'ALL' ? true : p.status === statusFilter))
      .sort(
        (a, b) =>
          b.setupStrength - a.setupStrength ||
          a.createdIndex - b.createdIndex ||
          a.id.localeCompare(b.id),
      )
  }, [qml?.patterns, visibilityMode, direction, statusFilter])

  if (!enabled) {
    return (
      <Card hover={false}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">QML Setups</CardTitle>
        </CardHeader>
        <CardContent className="text-[11px] text-muted-foreground">
          Quasimodo Level is Experimental and disabled. Enable it under Configure → QML.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card hover={false}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm">QML Setups</CardTitle>
          <Badge variant="outline" className="text-[10px]">
            Experimental
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={direction === 'BULLISH' ? 'default' : 'outline'}
            onClick={() => setDirection('BULLISH')}
          >
            Bullish
          </Button>
          <Button
            type="button"
            size="sm"
            variant={direction === 'BEARISH' ? 'default' : 'outline'}
            onClick={() => setDirection('BEARISH')}
          >
            Bearish
          </Button>
        </div>

        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              className={`rounded border px-1.5 py-0.5 text-[10px] ${
                statusFilter === s
                  ? 'border-foreground/40 bg-foreground/10'
                  : 'border-border text-muted-foreground'
              }`}
              onClick={() => setStatusFilter(s)}
            >
              {s}
            </button>
          ))}
        </div>

        {patterns.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">
            No {direction.toLowerCase()} QML patterns for this filter.
          </p>
        ) : (
          <ul className="space-y-2">
            {patterns.map((p) => {
              const selected = selectedQmlId === p.id
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    className={`w-full rounded-md border px-2 py-2 text-left text-[11px] transition ${
                      selected
                        ? 'border-amber-400/50 bg-amber-500/10'
                        : 'border-border hover:bg-muted/40'
                    }`}
                    onClick={() => onSelect(p)}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {p.direction === 'BULLISH' ? 'Bullish' : 'Bearish'} QML
                      </span>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        Strength {p.setupStrength}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {p.status}
                      </Badge>
                    </div>
                    {p.missingChecks.length > 0 ? (
                      <p className="mt-1 text-muted-foreground">
                        Missing: {p.missingChecks.join(', ')}
                      </p>
                    ) : (
                      <p className="mt-1 text-muted-foreground">
                        {p.status === 'ENTRY_READY'
                          ? 'ENTRY READY'
                          : p.explanation[0] ?? p.id}
                      </p>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        {qml?.diagnostics ? (
          <p className="font-mono text-[10px] text-muted-foreground">
            candidates {qml.diagnostics.structuralCandidates} · confirmed{' '}
            {qml.diagnostics.confirmedBullish + qml.diagnostics.confirmedBearish} · ready{' '}
            {qml.diagnostics.entryReady} · suppressed{' '}
            {qml.diagnostics.duplicatePatternsSuppressed}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
