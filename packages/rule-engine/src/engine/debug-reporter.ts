import type { DebugReport, RuleDebugEntry } from '../types/index.js'

export class DebugReporter {
  private entries = new Map<string, RuleDebugEntry>()

  startRule(ruleId: string, ruleName: string): void {
    this.entries.set(ruleId, {
      ruleId,
      ruleName,
      eventsFound: 0,
      executionMs: 0,
      rejectedConditions: [],
      matchedCandles: [],
      confidenceBreakdown: [],
    })
  }

  recordEvent(ruleId: string, candleIndex: number, confidence: number, explanation: string): void {
    const entry = this.entries.get(ruleId)
    if (!entry) return
    entry.eventsFound++
    entry.matchedCandles.push(candleIndex)
    entry.confidenceBreakdown.push({ index: candleIndex, confidence, explanation })
  }

  recordRejection(ruleId: string, condition: string): void {
    const entry = this.entries.get(ruleId)
    if (!entry) return
    if (!entry.rejectedConditions.includes(condition)) {
      entry.rejectedConditions.push(condition)
    }
  }

  finishRule(ruleId: string, executionMs: number): void {
    const entry = this.entries.get(ruleId)
    if (entry) entry.executionMs = executionMs
  }

  build(totalCandles: number, totalMs: number): DebugReport {
    return {
      rules: [...this.entries.values()],
      totalCandlesScanned: totalCandles,
      totalExecutionMs: totalMs,
    }
  }

  clear(): void {
    this.entries.clear()
  }
}
