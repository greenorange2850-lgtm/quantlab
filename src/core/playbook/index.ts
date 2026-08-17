// ─── Playbook Engine v1 — Public API ──────────────────────────────────────────

export type {
  PlaybookKind,
  PlaybookBias,
  PlaybookDirection,
  PlaybookStatus,
  PlaybookAction,
  ParameterValue,
  PlaybookParameters,
  PlaybookParameterSchema,
  PlaybookCheckTemplate,
  PlaybookDefinition,
  PlaybookEvent,
  PlaybookCandle,
  PlaybookContext,
  PlaybookCheck,
  PriceZone,
  ZoneSnapshot,
  EntryZone,
  StopReference,
  Target,
  EventChainLink,
  NextExpectedEvent,
  PlaybookEvaluationDiagnostics,
  PlaybookEvaluation,
  PlaybookHistoryResult,
  PlaybookDiagnostics,
  PlaybookConfig,
  RawPlaybookConfig,
  PlaybookSerialization,
} from './types.js'

export {
  PLAYBOOK_SCHEMA_VERSION,
  BUILTIN_PLAYBOOKS,
  BULLISH_QML_REVERSAL,
  BEARISH_QML_REVERSAL,
  BULLISH_CONTINUATION,
  BEARISH_CONTINUATION,
} from './definitions.js'

export { playbookRegistry } from './registry.js'

export {
  defaultParameters,
  resolveParameters,
  validateParameters,
  areParametersValid,
  validateDefinition,
  definitionIsValid,
  type ParameterIssue,
} from './parameters.js'

export {
  PLAYBOOK_STATUSES,
  PLAYBOOK_STATUS_TRANSITIONS,
  STATUS_LABELS,
  STATUS_ORDERS,
  canTransition,
  assertTransition,
  isTerminalStatus,
} from './status.js'

export {
  scoreSetupStrength,
  clamp,
  round1,
  REQUIRED_WEIGHT,
  OPTIONAL_WEIGHT,
} from './scoring.js'

export {
  atr,
  findSwingHighs,
  findSwingLows,
  swingHighsUpTo,
  swingLowsUpTo,
  detectStructureTrend,
  hasLowerHighs,
  hasLowerLows,
  hasHigherHighs,
  hasHigherLows,
  findBrokenSwingZone,
  countZoneTouches,
  evaluateZoneLifecycle,
  hasDisplacement,
  isBullishRejection,
  isBearishRejection,
  detectSweep,
  type SwingPoint,
  type StructureTrend,
  type BrokenSwingZone,
  type ZoneLifecycleStatus,
} from './structure.js'

export {
  eventsUpTo,
  eventsForRule,
  latestEvent,
  nearestEventNearZone,
  eventHasTag,
  toPlaybookCandle,
  toPlaybookCandles,
  type ZoneProximity,
} from './events.js'

export {
  evaluatePlaybookAt,
  evaluationFingerprint,
  paramNumber,
  paramBool,
  type EvaluationFacts,
} from './evaluator.js'

export {
  emptyDiagnostics,
  collectDiagnostics,
  evaluateInvariants,
  invariantFailuresFor,
  definitionStats,
  type DefinitionStats,
} from './diagnostics.js'

export {
  serializeEvaluation,
  deserializeEvaluation,
  fingerprintPlaybookConfig,
  serializePlaybookConfig,
  wrapSerialization,
  parseSerialization,
  PLAYBOOK_SERIALIZATION_FORMAT,
  PLAYBOOK_CONFIG_SCHEMA_VERSION,
} from './serialization.js'

export {
  buildPlaybookConfig,
  migratePlaybookConfig,
  configIsCurrent,
  PLAYBOOK_CONFIG_SCHEMA_VERSION as PERSISTENCE_SCHEMA_VERSION,
  type MigrationResult,
} from './persistence.js'

export {
  evaluatePlaybookHistory,
  replayPlaybook,
  applyLifecycleOutcomes,
  warmupIndex,
  scoreHistory,
  type PlaybookHistoryOptions,
} from './backtest.js'

export {
  runPlaybookPipeline,
  runAllPlaybooks,
  type PlaybookPipelineInput,
  type PlaybookPipelineResult,
} from './pipeline.js'

export { canonicalStringify, fingerprintHash } from './json.js'
