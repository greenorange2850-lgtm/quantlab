import { useState } from 'react'
import { Database, Loader2 } from 'lucide-react'
import type { DatasetMetadata } from '@/data/datasets'
import {
  useDatasetList,
  useDeleteDataset,
  useExportDatasetMetadata,
  useRefreshDatasetMetadata,
  useRenameDataset,
} from '@/api/queries/datasets'
import { Card, CardContent } from '@/components/ui/card'
import { DatasetCard } from './DatasetCard'
import { DatasetImportWizard } from './DatasetImportWizard'

export function DatasetLibraryPage() {
  const listQuery = useDatasetList()
  const renameMutation = useRenameDataset()
  const deleteMutation = useDeleteDataset()
  const refreshMutation = useRefreshDatasetMetadata()
  const exportMutation = useExportDatasetMetadata()
  const [actionError, setActionError] = useState<string | null>(null)

  const busy =
    renameMutation.isPending ||
    deleteMutation.isPending ||
    refreshMutation.isPending ||
    exportMutation.isPending

  const handleRename = async (dataset: DatasetMetadata) => {
    const next = window.prompt('Rename dataset', dataset.name)
    if (next === null) return
    setActionError(null)
    try {
      await renameMutation.mutateAsync({ id: dataset.id, name: next })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Rename failed')
    }
  }

  const handleDelete = async (dataset: DatasetMetadata) => {
    const confirmed = window.confirm(
      `Delete dataset "${dataset.name}"? Candle data will be removed from this browser.`,
    )
    if (!confirmed) return
    setActionError(null)
    try {
      await deleteMutation.mutateAsync(dataset.id)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const handleRefresh = async (dataset: DatasetMetadata) => {
    setActionError(null)
    try {
      await refreshMutation.mutateAsync(dataset.id)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Refresh failed')
    }
  }

  const handleExportMetadata = async (dataset: DatasetMetadata) => {
    setActionError(null)
    try {
      const exported = await exportMutation.mutateAsync(dataset.id)
      const blob = new Blob([JSON.stringify(exported, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${dataset.symbol.toLowerCase()}-dataset-metadata.json`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Export failed')
    }
  }

  const datasets = listQuery.data ?? []

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-6">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/20 bg-accent/15">
          <Database className="h-5 w-5 text-accent" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">Dataset Library</h2>
          <p className="text-pretty text-xs text-muted-foreground">
            Permanent local historical datasets for multi-market research. Import once,
            reuse in Optimizer and Strategy Lab without changing the backtest engine.
          </p>
        </div>
      </div>

      <DatasetImportWizard onImported={() => void listQuery.refetch()} />

      {actionError && (
        <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {actionError}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium">Your datasets</h3>
          {listQuery.isFetching && (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Syncing
            </span>
          )}
        </div>

        {listQuery.isLoading && (
          <Card className="border-dashed">
            <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading Dataset Library…
            </CardContent>
          </Card>
        )}

        {listQuery.isError && (
          <Card className="border-danger/30">
            <CardContent className="py-6 text-sm text-danger">
              {listQuery.error instanceof Error
                ? listQuery.error.message
                : 'Failed to load datasets'}
            </CardContent>
          </Card>
        )}

        {!listQuery.isLoading && !listQuery.isError && datasets.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <p className="text-sm font-medium">No datasets yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Import CSV files above to build your local historical library.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {datasets.map((dataset) => (
            <DatasetCard
              key={dataset.id}
              dataset={dataset}
              busy={busy}
              onRename={(item) => void handleRename(item)}
              onDelete={(item) => void handleDelete(item)}
              onRefresh={(item) => void handleRefresh(item)}
              onExportMetadata={(item) => void handleExportMetadata(item)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
