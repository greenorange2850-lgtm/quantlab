// ─── Rule Engine Types ────────────────────────────────────────────────────────

export type EventDirection = 'bullish' | 'bearish' | 'neutral' | 'warning' | 'rejected'
export type TimeframeCode = 'MN' | 'W1' | 'D1' | 'H4' | 'H1' | 'M30' | 'M15' | 'M5' | 'M1'

export const TIMEFRAME_HIERARCHY: TimeframeCode[] = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN']

export const HTF_MAP: Record<string, TimeframeCode> = {
  M1: 'M15', M5: 'H1', M15: 'H1', M30: 'H4',
  H1: 'H4', H4: 'D1', D1: 'W1', W1: 'MN', MN: 'MN',
}

export interface Candle {
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface RuleParameter {
  key: string
  label: string
  type: 'number' | 'boolean' | 'string' | 'select'
  default: unknown
  min?: number
  max?: number
  options?: string[]
  description?: string
}

export interface RuleMetadata {
  id: string
  name: string
  version: string
  description: string
  author: string
  priority: number
  dependencies: string[]
  parameters: RuleParameter[]
  outputEvents: string[]
  tags: string[]
}

export interface RuleDetection {
  ruleId: string
  ruleName: string
  timestamp: string
  candleIndex: number
  direction: EventDirection
  rawScore: number
  confidence: number
  tags: string[]
  metadata: Record<string, unknown>
  matchedCandles: number[]
  rejectedConditions: string[]
}

export interface MarketEvent {
  id: string
  ruleId: string
  ruleName: string
  ruleVersion: string
  symbol: string
  timeframe: string
  timestamp: string
  direction: EventDirection
  confidence: number
  score: number
  explanation: string
  tags: string[]
  metadata: Record<string, unknown>
  candleIndex?: number
  scanId?: string
  dependencies?: EventDependency[]
  scores?: EventScoreBreakdown[]
}

export interface EventDependency {
  dependsOnRule: string
  dependsOnEventId?: string
  relation: 'requires' | 'confirms' | 'contradicts'
}

export interface EventScoreBreakdown {
  metric: string
  value: number
  weight: number
}

export interface RuleContext {
  symbol: string
  timeframe: string
  candles: Candle[]
  index: number
  htfCandles?: Candle[]
  htfTimeframe?: string
  priorEvents: MarketEvent[]
  parameters: Record<string, unknown>
}

export interface ScanOptions {
  symbol: string
  timeframe: string
  rules?: string[]
  startDate?: string
  endDate?: string
  debug?: boolean
  composeRules?: boolean
  batchSize?: number
}

export interface ScanResult {
  scanId: string
  symbol: string
  timeframe: string
  events: MarketEvent[]
  eventsFound: number
  durationMs: number
  rulesExecuted: string[]
  debug?: DebugReport
}

export interface DebugReport {
  rules: RuleDebugEntry[]
  totalCandlesScanned: number
  totalExecutionMs: number
}

export interface RuleDebugEntry {
  ruleId: string
  ruleName: string
  eventsFound: number
  executionMs: number
  rejectedConditions: string[]
  matchedCandles: number[]
  confidenceBreakdown: Array<{ index: number; confidence: number; explanation: string }>
}

export interface CompositionRule {
  name: string
  requiredRules: string[]
  direction: EventDirection
  minConfidence?: number
}

export interface IRulePlugin {
  readonly metadata: RuleMetadata
  initialize(params?: Record<string, unknown>): void
  validate(context: RuleContext): boolean
  detect(context: RuleContext): RuleDetection[]
  score(detection: RuleDetection, context: RuleContext): number
  explain(detection: RuleDetection, context: RuleContext): string
  confidence(detection: RuleDetection, context: RuleContext): number
  export(detection: RuleDetection, context: RuleContext): Omit<MarketEvent, 'id' | 'scanId'>
}

export interface ICandleProvider {
  getCandles(symbol: string, timeframe: string, start?: string, end?: string): Candle[]
}

export interface IEventRepository {
  saveEvents(events: MarketEvent[], scanId: string): number
  getEvents(params: { symbol: string; timeframe: string; ruleName?: string; start?: string; end?: string; limit?: number }): MarketEvent[]
  getEventById(id: string): MarketEvent | null
  createScan(scan: { id: string; symbol: string; timeframe: string; rules: string[]; eventsFound: number; durationMs: number; debugMode: boolean }): void
  saveRuleDefinition(meta: RuleMetadata): void
  getRuleDefinitions(): RuleMetadata[]
}
