import type { Candle } from '../candles.js'
import type { Trade } from '../../core/backtest/Trade.js'
import type { BacktestExecutionEvent } from '../../core/backtest/execution-events.js'
import type {
  BacktestReplayBundle,
  BacktestReplayCandleRecord,
  BacktestReplayEventRecord,
  BacktestReplayMetadata,
  BacktestReplayStore,
  BacktestReplayTradeRecord,
} from './types.js'

export const REPLAY_DB = {
  name: 'quantlab-backtest-replay',
  version: 1,
  metadata: 'backtestReplayMetadata',
  candles: 'backtestReplayCandles',
  trades: 'backtestReplayTrades',
  events: 'backtestExecutionEvents',
} as const

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const factory = globalThis.indexedDB
    if (!factory) {
      reject(new Error('IndexedDB is not available in this environment'))
      return
    }

    const request = factory.open(REPLAY_DB.name, REPLAY_DB.version)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(REPLAY_DB.metadata)) {
        db.createObjectStore(REPLAY_DB.metadata, { keyPath: 'backtestId' })
      }
      if (!db.objectStoreNames.contains(REPLAY_DB.candles)) {
        db.createObjectStore(REPLAY_DB.candles, { keyPath: 'backtestId' })
      }
      if (!db.objectStoreNames.contains(REPLAY_DB.trades)) {
        db.createObjectStore(REPLAY_DB.trades, { keyPath: 'backtestId' })
      }
      if (!db.objectStoreNames.contains(REPLAY_DB.events)) {
        db.createObjectStore(REPLAY_DB.events, { keyPath: 'backtestId' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error('Failed to open replay IndexedDB'))
  })
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'))
  })
}

/** In-memory fallback used in tests / environments without IndexedDB. */
export class MemoryBacktestReplayStore implements BacktestReplayStore {
  private metadata = new Map<string, BacktestReplayMetadata>()
  private candles = new Map<string, Candle[]>()
  private trades = new Map<string, Trade[]>()
  private events = new Map<string, BacktestExecutionEvent[]>()
  private summaries = new Map<string, BacktestReplayBundle['reportSummary']>()

  async putBundle(bundle: BacktestReplayBundle): Promise<void> {
    this.metadata.set(bundle.metadata.backtestId, bundle.metadata)
    this.candles.set(bundle.metadata.backtestId, bundle.candles)
    this.trades.set(bundle.metadata.backtestId, bundle.trades)
    this.events.set(bundle.metadata.backtestId, bundle.events)
    this.summaries.set(bundle.metadata.backtestId, bundle.reportSummary)
  }

  async getMetadata(backtestId: string): Promise<BacktestReplayMetadata | null> {
    return this.metadata.get(backtestId) ?? null
  }

  async getCandles(backtestId: string): Promise<Candle[] | null> {
    return this.candles.get(backtestId) ?? null
  }

  async getTrades(backtestId: string): Promise<Trade[] | null> {
    return this.trades.get(backtestId) ?? null
  }

  async getEvents(backtestId: string): Promise<BacktestExecutionEvent[] | null> {
    return this.events.get(backtestId) ?? null
  }

  async getBundle(backtestId: string): Promise<BacktestReplayBundle | null> {
    const metadata = await this.getMetadata(backtestId)
    const candles = await this.getCandles(backtestId)
    const trades = await this.getTrades(backtestId)
    if (!metadata || !candles || !trades) return null
    return {
      metadata,
      candles,
      trades,
      events: (await this.getEvents(backtestId)) ?? [],
      reportSummary: this.summaries.get(backtestId) ?? null,
    }
  }

  async listMetadata(): Promise<BacktestReplayMetadata[]> {
    return [...this.metadata.values()].sort((a, b) => b.savedAt - a.savedAt)
  }

  async deleteBundle(backtestId: string): Promise<void> {
    this.metadata.delete(backtestId)
    this.candles.delete(backtestId)
    this.trades.delete(backtestId)
    this.events.delete(backtestId)
    this.summaries.delete(backtestId)
  }

  async clear(): Promise<void> {
    this.metadata.clear()
    this.candles.clear()
    this.trades.clear()
    this.events.clear()
    this.summaries.clear()
  }
}

export class IndexedDBBacktestReplayStore implements BacktestReplayStore {
  private dbPromise: Promise<IDBDatabase> | null = null

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = openDatabase().catch((error) => {
        this.dbPromise = null
        throw error
      })
    }
    return this.dbPromise
  }

  async putBundle(bundle: BacktestReplayBundle): Promise<void> {
    const db = await this.db()
    const tx = db.transaction(
      [REPLAY_DB.metadata, REPLAY_DB.candles, REPLAY_DB.trades, REPLAY_DB.events],
      'readwrite',
    )
    const done = transactionDone(tx)
    tx.objectStore(REPLAY_DB.metadata).put(bundle.metadata)
    const candleRecord: BacktestReplayCandleRecord = {
      backtestId: bundle.metadata.backtestId,
      candles: bundle.candles,
    }
    tx.objectStore(REPLAY_DB.candles).put(candleRecord)
    const tradeRecord: BacktestReplayTradeRecord = {
      backtestId: bundle.metadata.backtestId,
      trades: bundle.trades,
    }
    tx.objectStore(REPLAY_DB.trades).put(tradeRecord)
    const eventRecord: BacktestReplayEventRecord = {
      backtestId: bundle.metadata.backtestId,
      events: bundle.events,
    }
    tx.objectStore(REPLAY_DB.events).put(eventRecord)
    await done
  }

  async getMetadata(backtestId: string): Promise<BacktestReplayMetadata | null> {
    const db = await this.db()
    const tx = db.transaction(REPLAY_DB.metadata, 'readonly')
    const done = transactionDone(tx)
    const row = await requestToPromise(
      tx.objectStore(REPLAY_DB.metadata).get(backtestId) as IDBRequest<
        BacktestReplayMetadata | undefined
      >,
    )
    await done
    return row ?? null
  }

  async getCandles(backtestId: string): Promise<Candle[] | null> {
    const db = await this.db()
    const tx = db.transaction(REPLAY_DB.candles, 'readonly')
    const done = transactionDone(tx)
    const row = await requestToPromise(
      tx.objectStore(REPLAY_DB.candles).get(backtestId) as IDBRequest<
        BacktestReplayCandleRecord | undefined
      >,
    )
    await done
    return row?.candles ?? null
  }

  async getTrades(backtestId: string): Promise<Trade[] | null> {
    const db = await this.db()
    const tx = db.transaction(REPLAY_DB.trades, 'readonly')
    const done = transactionDone(tx)
    const row = await requestToPromise(
      tx.objectStore(REPLAY_DB.trades).get(backtestId) as IDBRequest<
        BacktestReplayTradeRecord | undefined
      >,
    )
    await done
    return row?.trades ?? null
  }

  async getEvents(backtestId: string): Promise<BacktestExecutionEvent[] | null> {
    const db = await this.db()
    const tx = db.transaction(REPLAY_DB.events, 'readonly')
    const done = transactionDone(tx)
    const row = await requestToPromise(
      tx.objectStore(REPLAY_DB.events).get(backtestId) as IDBRequest<
        BacktestReplayEventRecord | undefined
      >,
    )
    await done
    return row?.events ?? null
  }

  async getBundle(backtestId: string): Promise<BacktestReplayBundle | null> {
    const metadata = await this.getMetadata(backtestId)
    const candles = await this.getCandles(backtestId)
    const trades = await this.getTrades(backtestId)
    if (!metadata || !candles?.length || !trades) return null
    return {
      metadata,
      candles,
      trades,
      events: (await this.getEvents(backtestId)) ?? [],
      reportSummary: {
        netProfit: metadata.finalEquity - metadata.initialCapital,
        totalTrades: metadata.tradeCount,
        winRate: 0,
        profitFactor: 0,
        maxDrawdown: 0,
        finalBalance: metadata.finalEquity,
      },
    }
  }

  async listMetadata(): Promise<BacktestReplayMetadata[]> {
    const db = await this.db()
    const tx = db.transaction(REPLAY_DB.metadata, 'readonly')
    const done = transactionDone(tx)
    const rows = await requestToPromise(
      tx.objectStore(REPLAY_DB.metadata).getAll() as IDBRequest<BacktestReplayMetadata[]>,
    )
    await done
    return rows.sort((a, b) => b.savedAt - a.savedAt)
  }

  async deleteBundle(backtestId: string): Promise<void> {
    const db = await this.db()
    const tx = db.transaction(
      [REPLAY_DB.metadata, REPLAY_DB.candles, REPLAY_DB.trades, REPLAY_DB.events],
      'readwrite',
    )
    const done = transactionDone(tx)
    tx.objectStore(REPLAY_DB.metadata).delete(backtestId)
    tx.objectStore(REPLAY_DB.candles).delete(backtestId)
    tx.objectStore(REPLAY_DB.trades).delete(backtestId)
    tx.objectStore(REPLAY_DB.events).delete(backtestId)
    await done
  }

  async clear(): Promise<void> {
    const db = await this.db()
    const tx = db.transaction(
      [REPLAY_DB.metadata, REPLAY_DB.candles, REPLAY_DB.trades, REPLAY_DB.events],
      'readwrite',
    )
    const done = transactionDone(tx)
    tx.objectStore(REPLAY_DB.metadata).clear()
    tx.objectStore(REPLAY_DB.candles).clear()
    tx.objectStore(REPLAY_DB.trades).clear()
    tx.objectStore(REPLAY_DB.events).clear()
    await done
  }
}

let defaultStore: BacktestReplayStore | null = null

export function getBacktestReplayStore(): BacktestReplayStore {
  if (!defaultStore) {
    defaultStore =
      typeof indexedDB !== 'undefined'
        ? new IndexedDBBacktestReplayStore()
        : new MemoryBacktestReplayStore()
  }
  return defaultStore
}

/** Test helper. */
export function setBacktestReplayStoreForTests(store: BacktestReplayStore | null): void {
  defaultStore = store
}
