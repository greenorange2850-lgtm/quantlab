import { describe, expect, it } from 'vitest'
import type { BacktestSummary, CreateBacktestRequest } from '@trading-os/shared'
import {
  markEntryPersistence,
  mergeServerHistory,
  toNotSavedHistoryEntry,
  toPersistedHistoryEntry,
  toSavingHistoryEntry,
  upsertHistoryEntry,
} from '../backtest-history'

const summary = (id: string, market = 'BTCUSDT'): BacktestSummary => ({
  id,
  version: 'v1.0.0',
  date: '2024-01-10',
  market,
  timeframe: 'H1',
  trades: 4,
  winRate: 50,
  profitFactor: 1.5,
  maxDrawdown: -5,
  netProfit: 100,
  status: 'completed',
})

const request = (id: string): CreateBacktestRequest => ({
  id,
  version: 'v1.0.0',
  market: 'BTCUSDT',
  timeframe: 'H1',
  trades: 4,
  winRate: 50,
  profitFactor: 1.5,
  maxDrawdown: -5,
  netProfit: 100,
})

describe('backtest history view-model', () => {
  it('upserts optimistic saving entries to the front', () => {
    const existing = [toPersistedHistoryEntry(summary('bt-old'))]
    const next = toSavingHistoryEntry(summary('bt-new'), request('bt-new'))
    const merged = upsertHistoryEntry(existing, next)
    expect(merged.map((entry) => entry.summary.id)).toEqual(['bt-new', 'bt-old'])
    expect(merged[0]?.persistence).toBe('saving')
  })

  it('keeps local not_saved rows when reconciling server history', () => {
    const previous = [
      toNotSavedHistoryEntry(summary('bt-local'), request('bt-local')),
      toPersistedHistoryEntry(summary('bt-old')),
    ]
    const merged = mergeServerHistory([summary('bt-server', 'ETHUSDT')], previous)
    expect(merged.map((entry) => [entry.summary.id, entry.persistence])).toEqual([
      ['bt-local', 'not_saved'],
      ['bt-server', 'persisted'],
    ])
  })

  it('drops local pending rows once the server acknowledges the same id', () => {
    const previous = [toSavingHistoryEntry(summary('bt-1'), request('bt-1'))]
    const merged = mergeServerHistory([summary('bt-1')], previous)
    expect(merged).toHaveLength(1)
    expect(merged[0]?.persistence).toBe('persisted')
  })

  it('marks an entry as not_saved for retry', () => {
    const entries = [toSavingHistoryEntry(summary('bt-1'), request('bt-1'))]
    const updated = markEntryPersistence(entries, 'bt-1', 'not_saved', request('bt-1'))
    expect(updated[0]?.persistence).toBe('not_saved')
    expect(updated[0]?.pendingRequest?.id).toBe('bt-1')
  })
})
