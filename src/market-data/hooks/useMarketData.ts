import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { MarketDataSource } from '../types/index.js'
import { getApiBaseUrl } from '@/api/base-url'

const BASE = getApiBaseUrl()

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  const body = await res.json()
  if (!res.ok || !body.success) throw new Error(body.error?.message ?? 'Request failed')
  return body.data
}

export const mdeKeys = {
  symbols: ['mde', 'symbols'] as const,
  timeframes: ['mde', 'timeframes'] as const,
  sessions: ['mde', 'sessions'] as const,
  range: (symbol: string, tf: string) => ['mde', 'range', symbol, tf] as const,
  candles: (symbol: string, tf: string, limit: number) => ['mde', 'candles', symbol, tf, limit] as const,
  quality: (symbol: string, tf: string) => ['mde', 'quality', symbol, tf] as const,
  imports: ['mde', 'imports'] as const,
}

export function useMdeSymbols() {
  return useQuery({ queryKey: mdeKeys.symbols, queryFn: () => fetchJson<Array<{ id: string; name: string; displayName: string; assetClass: string }>>('/market-data/symbols') })
}

export function useMdeTimeframes() {
  return useQuery({ queryKey: mdeKeys.timeframes, queryFn: () => fetchJson<Array<{ id: string; code: string; minutes: number; label: string }>>('/market-data/timeframes') })
}

export function useMdeRange(symbol: string | null, timeframe: string | null) {
  return useQuery({
    queryKey: mdeKeys.range(symbol ?? '', timeframe ?? ''),
    queryFn: () => fetchJson<{ count: number; start: string; end: string }>(`/market-data/range?symbol=${symbol}&timeframe=${timeframe}`),
    enabled: !!symbol && !!timeframe,
  })
}

export function useMdeCandles(symbol: string | null, timeframe: string | null, limit = 200) {
  return useQuery({
    queryKey: mdeKeys.candles(symbol ?? '', timeframe ?? '', limit),
    queryFn: () => fetchJson<Array<Record<string, unknown>>>(`/market-data/candles?symbol=${symbol}&timeframe=${timeframe}&limit=${limit}`),
    enabled: !!symbol && !!timeframe,
  })
}

export function useMdeQuality(symbol: string | null, timeframe: string | null) {
  return useQuery({
    queryKey: mdeKeys.quality(symbol ?? '', timeframe ?? ''),
    queryFn: () => fetchJson<Record<string, unknown>>(`/market-data/quality?symbol=${symbol}&timeframe=${timeframe}`),
    enabled: !!symbol && !!timeframe,
  })
}

export function useMdeImports() {
  return useQuery({ queryKey: mdeKeys.imports, queryFn: () => fetchJson<Array<Record<string, unknown>>>('/market-data/imports') })
}

export function useMdeImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { file: File; source: MarketDataSource; symbol: string; timeframe: string }) => {
      const form = new FormData()
      form.append('file', params.file)
      form.append('source', params.source)
      form.append('symbol', params.symbol)
      form.append('timeframe', params.timeframe)
      const res = await fetch(`${BASE}/market-data/import`, { method: 'POST', body: form })
      const body = await res.json()
      if (!res.ok || !body.success) throw new Error(body.error?.message ?? 'Import failed')
      return body.data
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: mdeKeys.range(v.symbol, v.timeframe) })
      qc.invalidateQueries({ queryKey: mdeKeys.candles(v.symbol, v.timeframe, 200) })
      qc.invalidateQueries({ queryKey: mdeKeys.quality(v.symbol, v.timeframe) })
      qc.invalidateQueries({ queryKey: mdeKeys.imports })
    },
  })
}
