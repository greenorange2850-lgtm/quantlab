import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { PlaybookLabDataSourceKind } from '@/core/playbook'
import type { PlaybookHistoricalCatalogEntry } from '../load-historical'

interface DataSourceBarProps {
  kind: PlaybookLabDataSourceKind
  catalog: PlaybookHistoricalCatalogEntry[]
  catalogLoading: boolean
  selectedId: string | null
  selectedKind: 'backtest' | 'dataset' | null
  selectedTimeframe: string | null
  onKindChange: (kind: PlaybookLabDataSourceKind) => void
  onSelectSource: (
    kind: 'backtest' | 'dataset' | null,
    id: string | null,
    timeframe?: string | null,
  ) => void
  onTimeframeChange: (timeframe: string | null) => void
}

export function DataSourceBar({
  kind,
  catalog,
  catalogLoading,
  selectedId,
  selectedKind,
  selectedTimeframe,
  onKindChange,
  onSelectSource,
  onTimeframeChange,
}: DataSourceBarProps) {
  const selected = catalog.find((entry) => entry.kind === selectedKind && entry.id === selectedId)
  const needsTimeframe = Boolean(
    selected && selected.kind === 'dataset' && selected.timeframes.length > 1,
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SourceChip
          active={kind === 'demo'}
          label="Demo"
          hint="Fixtures"
          badge={kind === 'demo' ? 'Demo' : null}
          onClick={() => onKindChange('demo')}
        />
        <SourceChip
          active={kind === 'historical'}
          label="Historical"
          hint="Saved backtest / dataset"
          onClick={() => onKindChange('historical')}
        />
      </div>

      {kind === 'historical' && (
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
          <label className="min-w-0 flex-1 space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Saved source
            </span>
            <select
              value={selectedId && selectedKind ? `${selectedKind}:${selectedId}` : ''}
              disabled={catalogLoading || catalog.length === 0}
              onChange={(event) => {
                const value = event.target.value
                if (!value) {
                  onSelectSource(null, null, null)
                  return
                }
                const sep = value.indexOf(':')
                const nextKind = value.slice(0, sep) as 'backtest' | 'dataset'
                const nextId = value.slice(sep + 1)
                const entry = catalog.find((e) => e.kind === nextKind && e.id === nextId)
                const tf =
                  entry && entry.timeframes.length === 1
                    ? entry.timeframes[0]!
                    : entry?.timeframe ?? null
                onSelectSource(nextKind, nextId, tf)
              }}
              className="flex h-9 w-full rounded-lg border border-border bg-white/[0.03] px-3 text-sm disabled:opacity-50"
            >
              <option value="" className="bg-card-solid">
                {catalogLoading
                  ? 'Loading saved sources…'
                  : catalog.length === 0
                    ? 'No saved historical datasets'
                    : 'Select a saved backtest or dataset…'}
              </option>
              {catalog.map((entry) => (
                <option
                  key={`${entry.kind}:${entry.id}`}
                  value={`${entry.kind}:${entry.id}`}
                  className="bg-card-solid"
                >
                  {formatCatalogOption(entry)}
                </option>
              ))}
            </select>
          </label>

          {needsTimeframe && selected && (
            <label className="w-full space-y-1 sm:w-40">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Timeframe
              </span>
              <select
                value={selectedTimeframe ?? ''}
                onChange={(event) => onTimeframeChange(event.target.value || null)}
                className="flex h-9 w-full rounded-lg border border-border bg-white/[0.03] px-3 text-sm"
              >
                <option value="" className="bg-card-solid">
                  Select timeframe…
                </option>
                {selected.timeframes.map((tf) => (
                  <option key={tf} value={tf} className="bg-card-solid">
                    {tf}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
    </div>
  )
}

function formatCatalogOption(entry: PlaybookHistoricalCatalogEntry): string {
  const kindLabel = entry.kind === 'backtest' ? 'Backtest' : 'Dataset'
  const tf =
    entry.timeframe ??
    (entry.timeframes.length > 1 ? entry.timeframes.join('/') : entry.timeframes[0])
  const parts = [kindLabel, entry.label]
  if (entry.symbol && !entry.label.includes(entry.symbol)) parts.push(entry.symbol)
  if (tf) parts.push(tf)
  return parts.join(' · ')
}

function SourceChip({
  active,
  label,
  hint,
  badge,
  onClick,
}: {
  active: boolean
  label: string
  hint: string
  badge?: string | null
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors',
        active
          ? 'border-accent/40 bg-accent/10 text-foreground'
          : 'border-border bg-white/[0.02] text-muted hover:border-border-hover hover:text-foreground',
      )}
    >
      <span className="text-xs font-medium">{label}</span>
      <span className="text-[10px] text-muted-foreground">{hint}</span>
      {badge ? (
        <Badge variant="outline" className="px-1.5 py-0 text-[9px]">
          {badge}
        </Badge>
      ) : null}
    </button>
  )
}
