// ─── Playbook Engine — Core Types ─────────────────────────────────────────────
//
// A Playbook consumes existing detector outputs (Dow Theory, BOS, CHoCH, FVG,
// OB, Liquidity Sweep, Setup Engine, Zone Lifecycle) and evaluates trading
// rules. It is NOT a detector: it never mutates detector outputs and only
// returns derived playbook results.
//
// Definitions are JSON-safe, versioned and immutable.

export type PlaybookKind = 'qml-reversal' | 'continuation'
export type PlaybookBias = 'bullish' | 'bearish'
export type PlaybookDirection = 'long' | 'short' | 'neutral'

export type PlaybookStatus =
  | 'WATCHING'
  | 'WAITING_RETEST'
  | 'READY'
  | 'INVALIDATED'
  | 'COMPLETED'
  | 'EXPIRED'

/** Trader-first decision surfaced by the UI. */
export type PlaybookAction = 'BUY' | 'SELL' | 'WAIT' | 'NO_TRADE'

export type ParameterValue = number | boolean | string

export interface PlaybookParameters {
  [key: string]: ParameterValue
}

export interface PlaybookParameterSchema {
  key: string
  label: string
  type: 'number' | 'boolean' | 'select'
  default: ParameterValue
  min?: number
  max?: number
  step?: number
  options?: string[]
  description?: string
  group: 'required' | 'optional'
}

export interface PlaybookCheckTemplate {
  id: string
  label: string
  required: boolean
}

/**
 * Immutable, JSON-safe playbook definition. Instances are frozen and expose a
 * canonical serialized payload so identity/version/fingerprint stay stable.
 */
export interface PlaybookDefinition {
  readonly id: string
  readonly name: string
  readonly description: string
  /** SemVer of the rule logic, e.g. "1.0.0". */
  readonly version: string
  /** Format/API schema version of the definition payload. */
  readonly schemaVersion: number
  readonly kind: PlaybookKind
  readonly bias: PlaybookBias
  readonly tags: string[]
  readonly parameterSchema: readonly PlaybookParameterSchema[]
  /** Declared checks — consumed by the UI to show progress independent of data. */
  readonly checks: readonly PlaybookCheckTemplate[]
  /** Canonical JSON-safe serialization of this definition. */
  readonly serialized: string
}

// ─── Detector event input ─────────────────────────────────────────────────────

/** Minimal structural subset of rule-engine MarketEvent consumed by playbooks. */
export interface PlaybookEvent {
  id: string
  ruleId: string
  ruleName: string
  timestamp: string
  direction: 'bullish' | 'bearish' | 'neutral' | 'warning' | 'rejected'
  confidence: number
  score: number
  tags: string[]
  metadata: Record<string, unknown>
  candleIndex?: number
}

/** Candle in the playbook engine's own (timestamp-based) shape. */
export interface PlaybookCandle {
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

// ─── Context ──────────────────────────────────────────────────────────────────

export interface PlaybookContext {
  symbol: string
  timeframe: string
  /** Candles available at evaluation time — up to and including `index`. */
  candles: PlaybookCandle[]
  /** Index of the last candle the evaluation is allowed to see (no look-ahead). */
  index: number
  /** Detector outputs whose candleIndex/timeframe is <= evaluation point. */
  events: PlaybookEvent[]
  definition: PlaybookDefinition
  parameters: PlaybookParameters
}

// ─── Checks / zones / levels ──────────────────────────────────────────────────

export interface PlaybookCheck {
  id: string
  label: string
  required: boolean
  passed: boolean
  detail?: string
  /** Where the answer came from — detector event, structure or parameter gate. */
  source?: 'event' | 'structure' | 'parameter' | 'rule'
}

export interface PriceZone {
  top: number
  bottom: number
}

export interface ZoneSnapshot {
  kind: 'qml' | 'continuation'
  direction: PlaybookDirection
  zone: PriceZone
  formedAtTimestamp: string
  formedAtIndex: number
  touchedCount: number
  ageBars: number
  /** Structural invalidation (price through the far side of the zone). */
  invalidated: boolean
  /** Expired by age or excessive touches. */
  expired: boolean
  invalidationReason?: string
  label: string
}

export interface EntryZone {
  zone: PriceZone
  kind: 'qml' | 'order_block' | 'fvg' | 'continuation'
  label: string
  timestamp?: string
}

export interface StopReference {
  price: number
  kind: 'swing_low' | 'swing_high' | 'zone_beyond' | 'atr'
  label: string
}

export interface Target {
  order: number
  price: number
  kind: 'rr' | 'structure' | 'swing'
  label: string
}

export interface EventChainLink {
  label: string
  timestamp: string
  candleIndex: number
  sourceEventId?: string
  direction?: PlaybookDirection
}

export interface NextExpectedEvent {
  label: string
  detail?: string
}

export interface PlaybookEvaluationDiagnostics {
  evaluationDurationMs: number
  structureDurationMs: number
  eventDurationMs: number
}

// ─── Evaluation ───────────────────────────────────────────────────────────────

export interface PlaybookEvaluation {
  id: string
  playbookId: string
  playbookVersion: string
  symbol: string
  timeframe: string
  timestamp: string
  candleIndex: number
  direction: PlaybookDirection
  status: PlaybookStatus
  action: PlaybookAction
  /** 0-100. Setup quality only — never win probability. */
  strength: number
  checks: PlaybookCheck[]
  requiredChecks: PlaybookCheck[]
  optionalChecks: PlaybookCheck[]
  missingConditions: string[]
  warnings: string[]
  entryZone: EntryZone | null
  stopReference: StopReference | null
  targets: Target[]
  eventChain: EventChainLink[]
  nextExpectedEvent: NextExpectedEvent | null
  zone: ZoneSnapshot | null
  explanation: string
  parameters: PlaybookParameters
  diagnostics: PlaybookEvaluationDiagnostics
  /** JSON-safe serialized payload of this evaluation. */
  serialized: string
}

// ─── Backtest / history ───────────────────────────────────────────────────────

export interface PlaybookHistoryResult {
  playbookId: string
  playbookVersion: string
  symbol: string
  timeframe: string
  startTimestamp: string
  endTimestamp: string
  evaluations: PlaybookEvaluation[]
  readies: number
  watchCount: number
  waitRetestCount: number
  invalidatedCount: number
  completedCount: number
  expiredCount: number
  averageStrength: number
  maxStrength: number
  durationMs: number
}

// ─── Diagnostics ──────────────────────────────────────────────────────────────

export interface PlaybookDiagnostics {
  totalEvaluations: number
  byStatus: Record<PlaybookStatus, number>
  readyCount: number
  waitingRetestCount: number
  watchingCount: number
  invalidatedCount: number
  completedCount: number
  expiredCount: number
  averageStrength: number
  maxStrength: number
  minStrength: number
  strongest: PlaybookEvaluation | null
  weakest: PlaybookEvaluation | null
  /** checkId → number of times the check was missing/blocked. */
  missingConditions: Record<string, number>
  evaluationDurationMs: number
  totalEvaluationMs: number
  invariantFailures: string[]
}

// ─── Persistence ──────────────────────────────────────────────────────────────

export interface PlaybookConfig {
  schemaVersion: number
  playbookId: string
  playbookVersion: string
  parameters: PlaybookParameters
  fingerprint: string
  savedAt: string
}

/** Unknown persisted shape — migrated defensively on load. */
export interface RawPlaybookConfig {
  schemaVersion?: unknown
  playbookId?: unknown
  playbookVersion?: unknown
  parameters?: unknown
  fingerprint?: unknown
  savedAt?: unknown
  [key: string]: unknown
}

export interface PlaybookSerialization {
  format: 'quantlab-playbook'
  schemaVersion: number
  payload: unknown
}
