import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { IndexedDBDatasetStore, DATASET_DB } from '../indexeddb-store.js'
import type { Candle } from '../../candles.js'
import type { DatasetMetadata } from '../types.js'

type Handler = ((event: Event) => void) | null

class FakeRequest<T> {
  result: T
  error: DOMException | null = null
  onsuccess: Handler = null
  onerror: Handler = null

  constructor(result: T, autoSucceed = true) {
    this.result = result
    if (autoSucceed) {
      setTimeout(() => this.onsuccess?.(new Event('success')), 0)
    }
  }
}

class FakeIndex {
  private readonly store: FakeObjectStore
  private readonly field: string

  constructor(store: FakeObjectStore, field: string) {
    this.store = store
    this.field = field
  }

  getAll(query?: IDBValidKey) {
    const rows = [...this.store.data.values()].filter(
      (row) => (row as Record<string, unknown>)[this.field] === query,
    )
    return new FakeRequest(rows)
  }

  getAllKeys(query?: IDBValidKey) {
    const keys = [...this.store.data.entries()]
      .filter(([, row]) => (row as Record<string, unknown>)[this.field] === query)
      .map(([key]) => key)
    return new FakeRequest(keys)
  }
}

class FakeObjectStore {
  data = new Map<IDBValidKey, unknown>()
  indexes = new Map<string, string>()
  private readonly keyPath: string

  constructor(keyPath: string) {
    this.keyPath = keyPath
  }

  createIndex(name: string, keyPath: string) {
    this.indexes.set(name, keyPath)
  }

  index(name: string) {
    const field = this.indexes.get(name)
    if (!field) throw new Error(`index missing: ${name}`)
    return new FakeIndex(this, field)
  }

  put(value: Record<string, unknown>) {
    const key = value[this.keyPath] as IDBValidKey
    this.data.set(key, value)
    return new FakeRequest(key)
  }

  get(key: IDBValidKey) {
    return new FakeRequest(this.data.get(key))
  }

  getAll() {
    return new FakeRequest([...this.data.values()])
  }

  delete(key: IDBValidKey) {
    this.data.delete(key)
    return new FakeRequest(undefined)
  }
}

class FakeTransaction {
  oncomplete: Handler = null
  onerror: Handler = null
  onabort: Handler = null
  error: DOMException | null = null
  private readonly db: FakeDB

  constructor(db: FakeDB) {
    this.db = db
    setTimeout(() => this.oncomplete?.(new Event('complete')), 0)
  }

  objectStore(name: string) {
    const store = this.db.stores.get(name)
    if (!store) throw new Error(`store missing: ${name}`)
    return store
  }
}

class FakeDB {
  stores = new Map<string, FakeObjectStore>()
  objectStoreNames = {
    contains: (name: string) => this.stores.has(name),
  }

  createObjectStore(name: string, options: { keyPath: string }) {
    const store = new FakeObjectStore(options.keyPath)
    this.stores.set(name, store)
    return store
  }

  transaction(storeNames: string | string[]) {
    void storeNames
    return new FakeTransaction(this)
  }
}

function installFakeIndexedDB(db: FakeDB) {
  const fakeIndexedDB = {
    open: (_name: string, _version?: number) => {
      const request: {
        result: FakeDB | null
        error: DOMException | null
        onupgradeneeded: Handler
        onsuccess: Handler
        onerror: Handler
      } = {
        result: null,
        error: null,
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
      }

      setTimeout(() => {
        request.result = db
        request.onupgradeneeded?.(new Event('upgradeneeded'))
        request.onsuccess?.(new Event('success'))
      }, 0)

      return request
    },
  }

  vi.stubGlobal('indexedDB', fakeIndexedDB)
}

describe('IndexedDB schema + persistence', () => {
  let db: FakeDB

  beforeEach(() => {
    db = new FakeDB()
    installFakeIndexedDB(db)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates metadata and candles object stores with datasetId index', async () => {
    const store = new IndexedDBDatasetStore()
    await store.listMetadata()

    expect(DATASET_DB.name).toBe('quantlab-datasets')
    expect(DATASET_DB.version).toBe(1)
    expect(DATASET_DB.stores.metadata).toBe('metadata')
    expect(DATASET_DB.stores.candles).toBe('candles')
    expect(db.objectStoreNames.contains(DATASET_DB.stores.metadata)).toBe(true)
    expect(db.objectStoreNames.contains(DATASET_DB.stores.candles)).toBe(true)
    const candleStore = db.stores.get(DATASET_DB.stores.candles)!
    expect(candleStore.indexes.get('datasetId')).toBe('datasetId')
  })

  it('persists metadata and loads a single timeframe of candles', async () => {
    const store = new IndexedDBDatasetStore()
    const candles: Candle[] = [
      { time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 1 },
      { time: 2, open: 1.5, high: 2.2, low: 1.1, close: 2, volume: 2 },
    ]
    const meta: DatasetMetadata = {
      id: 'ds1',
      name: 'Gold (XAUUSD)',
      symbol: 'XAUUSD',
      marketType: 'gold',
      provider: 'local',
      timeframes: ['15m', '1h'],
      startDate: 1,
      endDate: 2,
      candles: 3,
      candleCounts: { '15m': 2, '1h': 1 },
      fileSize: 10,
      importedAt: 99,
      status: 'ready',
    }

    await store.putDataset(meta, {
      '15m': candles,
      '1h': [candles[0]!],
    })

    expect(await store.getMetadata('ds1')).toMatchObject({ id: 'ds1', name: 'Gold (XAUUSD)' })
    expect(await store.getCandles('ds1', '15m')).toEqual(candles)
    expect(await store.getCandles('ds1', '1h')).toHaveLength(1)
    expect(await store.getCandles('ds1', '4h')).toBeNull()

    await store.updateMetadata('ds1', { name: 'Gold Spot' })
    expect((await store.getMetadata('ds1'))!.name).toBe('Gold Spot')

    const refreshed = await store.refreshMetadata('ds1')
    expect(refreshed.candles).toBe(3)
    expect(refreshed.timeframes).toEqual(['15m', '1h'])

    await store.deleteDataset('ds1')
    expect(await store.getMetadata('ds1')).toBeNull()
    expect(await store.getCandles('ds1', '15m')).toBeNull()
  })
})
