import { useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { MarketSourceSelect } from '@/components/market/MarketSourceSelect'
import { DatasetSelect } from '@/components/market/DatasetSelect'
import { SymbolSelect } from '@/components/market/SymbolSelect'
import { TimeframeSelect } from '@/components/market/TimeframeSelect'
import { useDatasetList } from '@/api/queries/datasets'
import type { MarketSourceKind } from '@/data/market-source'
import type { BacktestTimeframe } from '@/data/binance-exchange-info'
import type { DatasetMetadata } from '@/data/datasets'
import { BACKTEST_TIMEFRAMES } from '@/data/binance-exchange-info'

export interface MarketSourceFieldsValue {
  sourceKind: MarketSourceKind
  datasetId: string | null
  symbol: string
  interval: BacktestTimeframe | string
}

interface MarketSourceFieldsProps {
  value: MarketSourceFieldsValue
  onChange: (next: Partial<MarketSourceFieldsValue>) => void
  /** Fired when a local dataset becomes selected — parents can align research period. */
  onDatasetReady?: (dataset: DatasetMetadata) => void
  disabled?: boolean
  idPrefix?: string
}

/**
 * Shared Market Source controls for Optimizer + Strategy Lab.
 * Both surfaces must present identical data providers.
 */
export function MarketSourceFields({
  value,
  onChange,
  onDatasetReady,
  disabled,
  idPrefix = 'market',
}: MarketSourceFieldsProps) {
  const datasetsQuery = useDatasetList()
  const datasets = datasetsQuery.data ?? []
  const selectedDataset: DatasetMetadata | null = useMemo(
    () => datasets.find((d) => d.id === value.datasetId) ?? null,
    [datasets, value.datasetId],
  )

  const onChangeRef = useRef(onChange)
  const onDatasetReadyRef = useRef(onDatasetReady)
  const lastReadyDatasetIdRef = useRef<string | null>(null)
  onChangeRef.current = onChange
  onDatasetReadyRef.current = onDatasetReady

  const localTimeframes = useMemo(() => {
    if (!selectedDataset) return [...BACKTEST_TIMEFRAMES]
    return selectedDataset.timeframes.length > 0
      ? selectedDataset.timeframes
      : [...BACKTEST_TIMEFRAMES]
  }, [selectedDataset])

  // Keep interval/symbol valid when switching dataset.
  useEffect(() => {
    if (value.sourceKind !== 'local') {
      lastReadyDatasetIdRef.current = null
      return
    }
    if (!selectedDataset) return

    const patch: Partial<MarketSourceFieldsValue> = {}
    if (!selectedDataset.timeframes.includes(value.interval)) {
      const next = selectedDataset.timeframes[0]
      if (next) patch.interval = next
    }
    if (value.symbol !== selectedDataset.symbol) {
      patch.symbol = selectedDataset.symbol
    }
    if (Object.keys(patch).length > 0) {
      onChangeRef.current(patch)
    }
    if (lastReadyDatasetIdRef.current !== selectedDataset.id) {
      lastReadyDatasetIdRef.current = selectedDataset.id
      onDatasetReadyRef.current?.(selectedDataset)
    }
  }, [selectedDataset, value.interval, value.sourceKind, value.symbol])

  return (
    <>
      <div className="min-w-0 space-y-2">
        <label
          htmlFor={`${idPrefix}-source`}
          className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
        >
          Market source
        </label>
        <MarketSourceSelect
          id={`${idPrefix}-source`}
          value={value.sourceKind}
          disabled={disabled}
          onChange={(kind) =>
            onChange({
              sourceKind: kind,
              datasetId: kind === 'local' ? value.datasetId : null,
            })
          }
        />
      </div>

      {value.sourceKind === 'binance' ? (
        <div className="min-w-0 space-y-2">
          <label
            htmlFor={`${idPrefix}-symbol`}
            className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
          >
            Market pair
          </label>
          <SymbolSelect
            id={`${idPrefix}-symbol`}
            value={value.symbol}
            onChange={(symbol) => onChange({ symbol })}
            disabled={disabled}
          />
        </div>
      ) : (
        <div className="min-w-0 space-y-2">
          <label
            htmlFor={`${idPrefix}-dataset`}
            className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
          >
            Dataset
          </label>
          <DatasetSelect
            id={`${idPrefix}-dataset`}
            datasets={datasets}
            value={value.datasetId}
            loading={datasetsQuery.isLoading}
            disabled={disabled}
            onChange={(datasetId) => {
              const ds = datasets.find((d) => d.id === datasetId) ?? null
              onChange({
                datasetId,
                symbol: ds?.symbol ?? value.symbol,
                interval: (ds?.timeframes[0] as BacktestTimeframe | undefined) ?? value.interval,
              })
            }}
          />
          {datasets.length === 0 && !datasetsQuery.isLoading && (
            <p className="text-[11px] text-muted-foreground">
              Import CSV datasets in{' '}
              <Link to="/dataset-library" className="text-accent underline-offset-2 hover:underline">
                Dataset Library
              </Link>
              .
            </p>
          )}
          {selectedDataset && (
            <p className="text-[11px] text-muted-foreground">
              Source: Local Dataset · {selectedDataset.name} ({selectedDataset.symbol})
            </p>
          )}
        </div>
      )}

      <div className="min-w-0 space-y-2">
        <label
          htmlFor={`${idPrefix}-timeframe`}
          className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
        >
          Timeframe
        </label>
        <TimeframeSelect
          id={`${idPrefix}-timeframe`}
          value={value.interval}
          timeframes={
            value.sourceKind === 'local'
              ? (localTimeframes as BacktestTimeframe[])
              : undefined
          }
          onChange={(interval) => onChange({ interval })}
          disabled={disabled || (value.sourceKind === 'local' && !selectedDataset)}
        />
      </div>
    </>
  )
}
