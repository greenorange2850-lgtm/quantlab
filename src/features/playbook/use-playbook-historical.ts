import { useCallback, useEffect, useState } from 'react'
import { usePlaybookStore } from '@/stores/playbook.store'
import {
  listPlaybookHistoricalCatalog,
  loadPlaybookHistoricalSource,
  type PlaybookHistoricalCatalogEntry,
  type PlaybookHistoricalLoadResult,
} from './load-historical'

export function usePlaybookHistoricalCatalog() {
  const [catalog, setCatalog] = useState<PlaybookHistoricalCatalogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setCatalog(await listPlaybookHistoricalCatalog())
    } catch (err) {
      setCatalog([])
      setError(err instanceof Error ? err.message : 'Could not list historical datasets')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { catalog, loading, error, refresh }
}

export function usePlaybookHistoricalSeries() {
  const dataSourceKind = usePlaybookStore((s) => s.dataSourceKind)
  const selectedHistoricalKind = usePlaybookStore((s) => s.selectedHistoricalKind)
  const selectedHistoricalId = usePlaybookStore((s) => s.selectedHistoricalId)
  const selectedHistoricalTimeframe = usePlaybookStore((s) => s.selectedHistoricalTimeframe)

  const [result, setResult] = useState<PlaybookHistoricalLoadResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (dataSourceKind !== 'historical' || !selectedHistoricalKind || !selectedHistoricalId) {
      setResult(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    void loadPlaybookHistoricalSource({
      kind: selectedHistoricalKind,
      id: selectedHistoricalId,
      timeframe: selectedHistoricalTimeframe,
    }).then((next) => {
      if (!cancelled) {
        setResult(next)
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
    }
  }, [
    dataSourceKind,
    selectedHistoricalKind,
    selectedHistoricalId,
    selectedHistoricalTimeframe,
  ])

  return { result, loading }
}
