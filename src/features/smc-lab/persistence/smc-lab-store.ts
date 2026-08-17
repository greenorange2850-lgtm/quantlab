import type { SmcGoldenDataset } from '@/core/smc'
import type { SmcLabExportPayload, SmcManualAnnotation, SmcReviewRecord } from './types'
import { SMC_LAB_DB } from './types'

export interface SmcLabStore {
  putReview(review: SmcReviewRecord): Promise<void>
  getReview(id: string): Promise<SmcReviewRecord | null>
  listReviews(datasetKey?: string): Promise<SmcReviewRecord[]>
  deleteReview(id: string): Promise<void>
  putAnnotation(annotation: SmcManualAnnotation): Promise<void>
  listAnnotations(datasetKey?: string): Promise<SmcManualAnnotation[]>
  deleteAnnotation(id: string): Promise<void>
  putGoldenDataset(dataset: SmcGoldenDataset): Promise<void>
  getGoldenDataset(id: string): Promise<SmcGoldenDataset | null>
  listGoldenDatasets(datasetKey?: string): Promise<SmcGoldenDataset[]>
  deleteGoldenDataset(id: string): Promise<void>
  clear(): Promise<void>
}

/** In-memory store for tests / environments without IndexedDB. */
export class MemorySmcLabStore implements SmcLabStore {
  private reviews = new Map<string, SmcReviewRecord>()
  private annotations = new Map<string, SmcManualAnnotation>()
  private goldens = new Map<string, SmcGoldenDataset>()

  async putReview(review: SmcReviewRecord): Promise<void> {
    this.reviews.set(review.id, { ...review, reasonTags: [...review.reasonTags] })
  }

  async getReview(id: string): Promise<SmcReviewRecord | null> {
    return this.reviews.get(id) ?? null
  }

  async listReviews(datasetKey?: string): Promise<SmcReviewRecord[]> {
    const all = [...this.reviews.values()]
    return (datasetKey ? all.filter((r) => r.datasetKey === datasetKey) : all).sort(
      (a, b) => b.reviewedAt - a.reviewedAt,
    )
  }

  async deleteReview(id: string): Promise<void> {
    this.reviews.delete(id)
  }

  async putAnnotation(annotation: SmcManualAnnotation): Promise<void> {
    this.annotations.set(annotation.id, { ...annotation })
  }

  async listAnnotations(datasetKey?: string): Promise<SmcManualAnnotation[]> {
    const all = [...this.annotations.values()]
    return (datasetKey ? all.filter((a) => a.datasetKey === datasetKey) : all).sort(
      (a, b) => a.timestamp - b.timestamp,
    )
  }

  async deleteAnnotation(id: string): Promise<void> {
    this.annotations.delete(id)
  }

  async putGoldenDataset(dataset: SmcGoldenDataset): Promise<void> {
    this.goldens.set(dataset.id, {
      ...dataset,
      labels: dataset.labels.map((l) => ({ ...l, reasonTags: l.reasonTags ? [...l.reasonTags] : undefined })),
    })
  }

  async getGoldenDataset(id: string): Promise<SmcGoldenDataset | null> {
    return this.goldens.get(id) ?? null
  }

  async listGoldenDatasets(datasetKey?: string): Promise<SmcGoldenDataset[]> {
    const all = [...this.goldens.values()]
    return (datasetKey ? all.filter((d) => d.datasetKey === datasetKey) : all).sort(
      (a, b) => b.updatedAt - a.updatedAt,
    )
  }

  async deleteGoldenDataset(id: string): Promise<void> {
    this.goldens.delete(id)
  }

  async clear(): Promise<void> {
    this.reviews.clear()
    this.annotations.clear()
    this.goldens.clear()
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const factory = globalThis.indexedDB
    if (!factory) {
      reject(new Error('IndexedDB is not available'))
      return
    }
    const request = factory.open(SMC_LAB_DB.name, SMC_LAB_DB.version)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(SMC_LAB_DB.reviews)) {
        const store = db.createObjectStore(SMC_LAB_DB.reviews, { keyPath: 'id' })
        store.createIndex('datasetKey', 'datasetKey', { unique: false })
      }
      if (!db.objectStoreNames.contains(SMC_LAB_DB.annotations)) {
        const store = db.createObjectStore(SMC_LAB_DB.annotations, { keyPath: 'id' })
        store.createIndex('datasetKey', 'datasetKey', { unique: false })
      }
      if (!db.objectStoreNames.contains(SMC_LAB_DB.goldenDatasets)) {
        const store = db.createObjectStore(SMC_LAB_DB.goldenDatasets, { keyPath: 'id' })
        store.createIndex('datasetKey', 'datasetKey', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error('Failed to open SMC Lab IndexedDB'))
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

export class IndexedDBSmcLabStore implements SmcLabStore {
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

  async putReview(review: SmcReviewRecord): Promise<void> {
    const db = await this.db()
    const tx = db.transaction(SMC_LAB_DB.reviews, 'readwrite')
    const done = transactionDone(tx)
    tx.objectStore(SMC_LAB_DB.reviews).put(review)
    await done
  }

  async getReview(id: string): Promise<SmcReviewRecord | null> {
    const db = await this.db()
    const tx = db.transaction(SMC_LAB_DB.reviews, 'readonly')
    const value = await requestToPromise(
      tx.objectStore(SMC_LAB_DB.reviews).get(id) as IDBRequest<SmcReviewRecord | undefined>,
    )
    return value ?? null
  }

  async listReviews(datasetKey?: string): Promise<SmcReviewRecord[]> {
    const db = await this.db()
    const tx = db.transaction(SMC_LAB_DB.reviews, 'readonly')
    const store = tx.objectStore(SMC_LAB_DB.reviews)
    if (datasetKey) {
      const index = store.index('datasetKey')
      const values = await requestToPromise(
        index.getAll(datasetKey) as IDBRequest<SmcReviewRecord[]>,
      )
      return values.sort((a, b) => b.reviewedAt - a.reviewedAt)
    }
    const values = await requestToPromise(store.getAll() as IDBRequest<SmcReviewRecord[]>)
    return values.sort((a, b) => b.reviewedAt - a.reviewedAt)
  }

  async deleteReview(id: string): Promise<void> {
    const db = await this.db()
    const tx = db.transaction(SMC_LAB_DB.reviews, 'readwrite')
    const done = transactionDone(tx)
    tx.objectStore(SMC_LAB_DB.reviews).delete(id)
    await done
  }

  async putAnnotation(annotation: SmcManualAnnotation): Promise<void> {
    const db = await this.db()
    const tx = db.transaction(SMC_LAB_DB.annotations, 'readwrite')
    const done = transactionDone(tx)
    tx.objectStore(SMC_LAB_DB.annotations).put(annotation)
    await done
  }

  async listAnnotations(datasetKey?: string): Promise<SmcManualAnnotation[]> {
    const db = await this.db()
    const tx = db.transaction(SMC_LAB_DB.annotations, 'readonly')
    const store = tx.objectStore(SMC_LAB_DB.annotations)
    if (datasetKey) {
      const index = store.index('datasetKey')
      const values = await requestToPromise(
        index.getAll(datasetKey) as IDBRequest<SmcManualAnnotation[]>,
      )
      return values.sort((a, b) => a.timestamp - b.timestamp)
    }
    const values = await requestToPromise(store.getAll() as IDBRequest<SmcManualAnnotation[]>)
    return values.sort((a, b) => a.timestamp - b.timestamp)
  }

  async deleteAnnotation(id: string): Promise<void> {
    const db = await this.db()
    const tx = db.transaction(SMC_LAB_DB.annotations, 'readwrite')
    const done = transactionDone(tx)
    tx.objectStore(SMC_LAB_DB.annotations).delete(id)
    await done
  }

  async putGoldenDataset(dataset: SmcGoldenDataset): Promise<void> {
    const db = await this.db()
    const tx = db.transaction(SMC_LAB_DB.goldenDatasets, 'readwrite')
    const done = transactionDone(tx)
    tx.objectStore(SMC_LAB_DB.goldenDatasets).put(dataset)
    await done
  }

  async getGoldenDataset(id: string): Promise<SmcGoldenDataset | null> {
    const db = await this.db()
    const tx = db.transaction(SMC_LAB_DB.goldenDatasets, 'readonly')
    const value = await requestToPromise(
      tx.objectStore(SMC_LAB_DB.goldenDatasets).get(id) as IDBRequest<
        SmcGoldenDataset | undefined
      >,
    )
    return value ?? null
  }

  async listGoldenDatasets(datasetKey?: string): Promise<SmcGoldenDataset[]> {
    const db = await this.db()
    const tx = db.transaction(SMC_LAB_DB.goldenDatasets, 'readonly')
    const store = tx.objectStore(SMC_LAB_DB.goldenDatasets)
    if (datasetKey) {
      const index = store.index('datasetKey')
      const values = await requestToPromise(
        index.getAll(datasetKey) as IDBRequest<SmcGoldenDataset[]>,
      )
      return values.sort((a, b) => b.updatedAt - a.updatedAt)
    }
    const values = await requestToPromise(store.getAll() as IDBRequest<SmcGoldenDataset[]>)
    return values.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async deleteGoldenDataset(id: string): Promise<void> {
    const db = await this.db()
    const tx = db.transaction(SMC_LAB_DB.goldenDatasets, 'readwrite')
    const done = transactionDone(tx)
    tx.objectStore(SMC_LAB_DB.goldenDatasets).delete(id)
    await done
  }

  async clear(): Promise<void> {
    const db = await this.db()
    const stores = [SMC_LAB_DB.reviews, SMC_LAB_DB.annotations, SMC_LAB_DB.goldenDatasets]
    const tx = db.transaction(stores, 'readwrite')
    const done = transactionDone(tx)
    for (const name of stores) {
      if (db.objectStoreNames.contains(name)) {
        tx.objectStore(name).clear()
      }
    }
    await done
  }
}

let defaultStore: SmcLabStore | null = null

export function getSmcLabStore(): SmcLabStore {
  if (!defaultStore) {
    defaultStore =
      typeof indexedDB !== 'undefined' ? new IndexedDBSmcLabStore() : new MemorySmcLabStore()
  }
  return defaultStore
}

export function setSmcLabStoreForTests(store: SmcLabStore | null): void {
  defaultStore = store
}

export function validateSmcLabExport(payload: unknown): SmcLabExportPayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid SMC Lab export: expected object')
  }
  const data = payload as Partial<SmcLabExportPayload>
  if (data.schemaVersion !== 1 && data.schemaVersion !== 2 && data.schemaVersion !== 3) {
    throw new Error(`Unsupported SMC Lab export schema: ${String(data.schemaVersion)}`)
  }
  if (!data.detectorConfig || !Array.isArray(data.reviews) || !Array.isArray(data.annotations)) {
    throw new Error('Invalid SMC Lab export: missing required fields')
  }
  return data as SmcLabExportPayload
}
