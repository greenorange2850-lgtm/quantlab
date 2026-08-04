import { cn } from '@/lib/utils'
import type { DatasetMetadata } from '@/data/datasets'
import { DATASET_MARKET_TYPE_LABELS } from '@/data/datasets'

interface DatasetSelectProps {
  datasets: DatasetMetadata[]
  value: string | null
  onChange: (datasetId: string | null) => void
  disabled?: boolean
  loading?: boolean
  id?: string
  className?: string
}

export function DatasetSelect({
  datasets,
  value,
  onChange,
  disabled,
  loading,
  id = 'dataset-select',
  className,
}: DatasetSelectProps) {
  const ready = datasets.filter((d) => d.status === 'ready')

  return (
    <select
      id={id}
      value={value ?? ''}
      disabled={disabled || loading || ready.length === 0}
      onChange={(event) => onChange(event.target.value || null)}
      className={cn(
        'flex h-11 w-full rounded-lg border border-border bg-white/[0.03] px-3 text-sm disabled:opacity-50',
        className,
      )}
    >
      <option value="" className="bg-card-solid">
        {loading
          ? 'Loading datasets…'
          : ready.length === 0
            ? 'No local datasets — import in Dataset Library'
            : 'Select dataset…'}
      </option>
      {ready.map((dataset) => (
        <option key={dataset.id} value={dataset.id} className="bg-card-solid">
          {dataset.name} · {DATASET_MARKET_TYPE_LABELS[dataset.marketType]} ·{' '}
          {dataset.symbol}
        </option>
      ))}
    </select>
  )
}
