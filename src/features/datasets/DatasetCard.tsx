import { Link } from 'react-router-dom'
import {
  formatCoverageDate,
  formatFileSize,
  type DatasetMetadata,
  DATASET_MARKET_TYPE_LABELS,
  DATASET_PROVIDER_LABELS,
} from '@/data/datasets'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatPeriodLabel } from '@/data/research-period'

interface DatasetCardProps {
  dataset: DatasetMetadata
  onRename: (dataset: DatasetMetadata) => void
  onDelete: (dataset: DatasetMetadata) => void
  onRefresh: (dataset: DatasetMetadata) => void
  onExportMetadata: (dataset: DatasetMetadata) => void
  busy?: boolean
}

export function DatasetCard({
  dataset,
  onRename,
  onDelete,
  onRefresh,
  onExportMetadata,
  busy,
}: DatasetCardProps) {
  const providerLabel =
    DATASET_PROVIDER_LABELS[dataset.provider] ?? dataset.provider

  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <CardTitle className="truncate text-base">{dataset.name}</CardTitle>
          <p className="font-mono text-xs text-muted-foreground">{dataset.symbol}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="text-[10px]">
            {DATASET_MARKET_TYPE_LABELS[dataset.marketType]}
          </Badge>
          <Badge variant="accent" className="text-[10px]">
            {providerLabel}
          </Badge>
          {dataset.status === 'ready' ? (
            <Badge variant="outline" className="text-[10px] text-success">
              Ready
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-danger">
              {dataset.status}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-xs text-muted-foreground">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] uppercase tracking-wider">Imported</p>
            <p className="text-foreground">
              {new Date(dataset.importedAt).toLocaleString()}
            </p>
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] uppercase tracking-wider">Coverage</p>
            <p className="text-foreground">
              {formatCoverageDate(dataset.startDate)}
              <span className="text-muted-foreground"> → </span>
              {formatCoverageDate(dataset.endDate)}
            </p>
            <p className="text-[10px]">
              {formatPeriodLabel(dataset.startDate, dataset.endDate)}
            </p>
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] uppercase tracking-wider">Candle count</p>
            <p className="font-mono text-foreground">
              {dataset.candles.toLocaleString()}
            </p>
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] uppercase tracking-wider">File size</p>
            <p className="font-mono text-foreground">
              {formatFileSize(dataset.fileSize)}
            </p>
          </div>
          <div className="min-w-0 space-y-1 sm:col-span-2">
            <p className="text-[10px] uppercase tracking-wider">Timeframes</p>
            <div className="flex flex-wrap gap-1.5">
              {dataset.timeframes.map((tf) => (
                <span
                  key={tf}
                  className="inline-flex items-center gap-1 rounded border border-border/60 bg-white/[0.03] px-2 py-0.5 font-mono text-[11px] text-foreground"
                >
                  <span className="text-success">✓</span>
                  {tf}
                  <span className="text-muted-foreground">
                    ({(dataset.candleCounts[tf] ?? 0).toLocaleString()})
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-9"
            disabled={busy}
            onClick={() => onRename(dataset)}
          >
            Rename
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="min-h-9"
            disabled={busy}
            onClick={() => onRefresh(dataset)}
          >
            Refresh metadata
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9"
            disabled={busy}
            onClick={() => onExportMetadata(dataset)}
          >
            Export metadata
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-9 text-danger hover:text-danger"
            disabled={busy}
            onClick={() => onDelete(dataset)}
          >
            Delete
          </Button>
          <Link to={`/optimizer?source=local&dataset=${dataset.id}`} className="w-full sm:w-auto">
            <Button type="button" variant="outline" size="sm" className="min-h-9 w-full sm:w-auto">
              Use in Optimizer
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
