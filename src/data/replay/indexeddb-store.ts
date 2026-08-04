import type { Candle } from '../candles.js'
import type { Trade } from '../../core/backtest/Trade.js'
import type { BacktestExecutionEvent } from '../../core/backtest/execution-events.js'
import type {
  BacktestReplayBundle,
  BacktestReplayCandleRecord,
  BacktestReplayEquityRecord,
  BacktestReplayEventRecord,
  BacktestReplayMetadata,
  BacktestReplayStore,
  BacktestReplayTradeRecord,
} from './types.js'

export const REPLAY_DB = {
  name: 'quantlab-backtest-replay',
  version: 2,
  metadata: 'backtestReplayMetadata',
  candles: 'backtestReplayCandles',
  trades: 'backtestReplayTrades',
  events: 'backtestExecutionEvents',
  equity: 'backtestReplayEquity',
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
      if (!db.objectStoreNames.contains(REPLAY_DB.equity)) {
        db.createObjectStore(REPLAY_DB.equity, { keyPath: 'backtestId' })
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

const ALL_STORES = [
  REPLAY_DB.metadata,
  REPLAY_DB.candles,
  REPLAY_DB.trades,
  REPLAY_DB.events,
  REPLAY_DB.equity,
] as const

/** In-memory fallback used in tests / environments without IndexedDB. */
export class MemoryBacktestReplayStore implements BacktestReplayStore {
  private bundles = new Map<string, BacktestReplayBundle>()

  async putBundle(bundle: BacktestReplayBundle): Promise<void> {
    this.bundles.set(bundle.metadata.backtestId, {
      ...bundle,
      candles: [...bundle.candles],
      trades: [...bundle.trades],
      events: [...bundle.events],
      equityCurve: [...bundle.equityCurve],
    })
  }

  async getMetadata(backtestId: string): Promise<BacktestReplayMetadata | null> {
    return this.bundles.get(backtestId)?.metadata ?? null
  }

  async getCandles(backtestId: string): Promise<Candle[] | null> {
    return this.bundles.get(backtestId)?.candles ?? null
  }

  async getTrades(backtestId: string): Promise<Trade[] | null> {
    return this.bundles.get(backtestId)?.trades ?? null
  }

  async getEvents(backtestId: string): Promise<BacktestExecutionEvent[] | null> {
    return this.bundles.get(backtestId)?.events ?? null
  }

  async getBundle(backtestId: string): Promise<BacktestReplayBundle | null> {
    const bundle = this.bundles.get(backtestId)
    if (!bundle || bundle.candles.length === 0) return null
    return {
      ...bundle,
      candles: [...bundle.candles],
      trades: [...bundle.trades],
      events: [...bundle.events],
      equityCurve: [...bundle.equityCurve],
    }
  }

  async listMetadata(): Promise<BacktestReplayMetadata[]> {
    return [...this.bundles.values()]
      .map((bundle) => bundle.metadata)
      .sort((a, b) => b.savedAt - a.savedAt)
  }

  async deleteBundle(backtestId: string): Promise<void> {
    this.bundles.delete(backtestId)
  }

  async clear(): Promise<void> {
    this.bundles.clear()
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
    const tx = db.transaction([...ALL_STORES], 'readwrite')
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
    const equityRecord: BacktestReplayEquityRecord = {
      backtestId: bundle.metadata.backtestId,
      equityCurve: bundle.equityCurve,
      reportSummary: bundle.reportSummary,
    }
    tx.objectStore(REPLAY_DB.equity).put(equityRecord)
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

    const db = await this.db()
    const tx = db.transaction(REPLAY_DB.equity, 'readonly')
    const done = transactionDone(tx)
    const equity = await requestToPromise(
      tx.objectStore(REPLAY_DB.equity).get(backtestId) as IDBRequest<
        BacktestReplayEquityRecord | undefined
      >,
    )
    await done

    return {
      metadata,
      candles,
      trades,
      events: (await this.getEvents(backtestId)) ?? [],
      equityCurve: equity?.equityCurve ?? [],
      reportSummary: equity?.reportSummary ?? {
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
    const tx = db.transaction([...ALL_STORES], 'readwrite')
    const done = transactionDone(tx)
    for (const store of ALL_STORES) {
      tx.objectStore(store).delete(backtestId)
    }
    await done
  }

  async clear(): Promise<void> {
    const db = await this.db()
    const tx = db.transaction([...ALL_STORES], 'readwrite')
    const done = transactionDone(tx)
    for (const store of ALL_STORES) {
      tx.objectStore(store).clear()
    }
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
