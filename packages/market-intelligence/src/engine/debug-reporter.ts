import type { IntelligenceDebugReport, EngineDebugEntry } from '../types/index.js'

export class IntelligenceDebugReporter {
  private entries = new Map<string, EngineDebugEntry>()

  startEngine(name: string): void {
    this.entries.set(name, { engine: name, executionMs: 0, avgScore: 0, tagsGenerated: 0 })
  }

  recordEngine(name: string, executionMs: number, score: number, tagCount: number): void {
    const entry = this.entries.get(name)
    if (!entry) return
    entry.executionMs += executionMs
    entry.avgScore = (entry.avgScore + score) / 2
    entry.tagsGenerated += tagCount
  }

  build(totalEvents: number, totalMs: number): IntelligenceDebugReport {
    return {
      engines: [...this.entries.values()],
      totalEvents,
      totalExecutionMs: totalMs,
    }
  }

  clear(): void {
    this.entries.clear()
  }
}
