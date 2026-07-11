import type { MarketEvent, IEventRepository } from '../types/index.js'
import { createEventId } from '../core/base-rule-plugin.js'

export class EventEngine {
  constructor(private readonly repository: IEventRepository) {}

  persist(events: MarketEvent[], scanId: string): number {
    const withIds = events.map((e) => ({
      ...e,
      id: e.id || createEventId(),
      scanId,
    }))
    return this.repository.saveEvents(withIds, scanId)
  }

  query(params: {
    symbol: string
    timeframe: string
    ruleName?: string
    start?: string
    end?: string
    limit?: number
  }): MarketEvent[] {
    return this.repository.getEvents(params)
  }

  getById(id: string): MarketEvent | null {
    return this.repository.getEventById(id)
  }

  recordScan(scan: {
    id: string
    symbol: string
    timeframe: string
    rules: string[]
    eventsFound: number
    durationMs: number
    debugMode: boolean
  }): void {
    this.repository.createScan(scan)
  }
}
