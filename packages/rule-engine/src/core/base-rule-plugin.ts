import { randomUUID } from 'node:crypto'
import type {
  IRulePlugin,
  RuleMetadata,
  RuleContext,
  RuleDetection,
  MarketEvent,
  RuleParameter,
} from '../types/index.js'

export abstract class BaseRulePlugin implements IRulePlugin {
  protected params: Record<string, unknown> = {}

  abstract readonly metadata: RuleMetadata

  initialize(params?: Record<string, unknown>): void {
    this.params = { ...this.defaultParams(), ...params }
  }

  protected defaultParams(): Record<string, unknown> {
    const defaults: Record<string, unknown> = {}
    for (const p of this.metadata.parameters) defaults[p.key] = p.default
    return defaults
  }

  protected param<T>(key: string, fallback: T): T {
    return (this.params[key] as T) ?? fallback
  }

  validate(context: RuleContext): boolean {
    return context.candles.length > 0 && context.index >= 0 && context.index < context.candles.length
  }

  abstract detect(context: RuleContext): RuleDetection[]

  score(detection: RuleDetection, _context: RuleContext): number {
    return detection.rawScore
  }

  explain(detection: RuleDetection, context: RuleContext): string {
    return `${this.metadata.name} detected at ${detection.timestamp} on ${context.symbol} ${context.timeframe}`
  }

  confidence(detection: RuleDetection, context: RuleContext): number {
    const base = Math.min(100, Math.max(0, detection.rawScore))
    const score = this.score(detection, context)
    return Math.min(100, Math.round((base * 0.6 + score * 0.4) * 10) / 10)
  }

  export(detection: RuleDetection, context: RuleContext): Omit<MarketEvent, 'id' | 'scanId'> {
    return {
      ruleId: this.metadata.id,
      ruleName: this.metadata.name,
      ruleVersion: this.metadata.version,
      symbol: context.symbol,
      timeframe: context.timeframe,
      timestamp: detection.timestamp,
      direction: detection.direction,
      confidence: this.confidence(detection, context),
      score: this.score(detection, context),
      explanation: this.explain(detection, context),
      tags: [...this.metadata.tags, ...detection.tags],
      metadata: detection.metadata,
      candleIndex: detection.candleIndex,
    }
  }

  protected detection(
    context: RuleContext,
    direction: RuleDetection['direction'],
    rawScore: number,
    metadata: Record<string, unknown>,
    tags: string[] = [],
    matchedCandles: number[] = [],
    rejectedConditions: string[] = [],
  ): RuleDetection {
    return {
      ruleId: this.metadata.id,
      ruleName: this.metadata.name,
      timestamp: context.candles[context.index].timestamp,
      candleIndex: context.index,
      direction,
      rawScore,
      confidence: 0,
      tags,
      metadata,
      matchedCandles: matchedCandles.length ? matchedCandles : [context.index],
      rejectedConditions,
    }
  }

  protected static params(...defs: RuleParameter[]): RuleParameter[] {
    return defs
  }
}

export function createEventId(): string {
  return randomUUID()
}
