// ─── Playbook Engine — Diagnostics & Invariants ───────────────────────────────

import { isTerminalStatus, PLAYBOOK_STATUSES } from './status.js'
import type {
  PlaybookDefinition,
  PlaybookDiagnostics,
  PlaybookEvaluation,
  PlaybookStatus,
} from './types.js'

export function emptyDiagnostics(): PlaybookDiagnostics {
  return {
    totalEvaluations: 0,
    byStatus: {
      WATCHING: 0,
      WAITING_RETEST: 0,
      READY: 0,
      INVALIDATED: 0,
      COMPLETED: 0,
      EXPIRED: 0,
    },
    readyCount: 0,
    waitingRetestCount: 0,
    watchingCount: 0,
    invalidatedCount: 0,
    completedCount: 0,
    expiredCount: 0,
    averageStrength: 0,
    maxStrength: 0,
    minStrength: 0,
    strongest: null,
    weakest: null,
    missingConditions: {},
    evaluationDurationMs: 0,
    totalEvaluationMs: 0,
    invariantFailures: [],
  }
}

/** Aggregate diagnostics over a set of evaluations (e.g. a history replay). */
export function collectDiagnostics(evaluations: PlaybookEvaluation[]): PlaybookDiagnostics {
  const diagnostics = emptyDiagnostics()
  diagnostics.totalEvaluations = evaluations.length
  if (evaluations.length === 0) return diagnostics

  let strengthSum = 0
  let durationSum = 0
  let max = -Infinity
  let min = Infinity
  let strongest: PlaybookEvaluation | null = null
  let weakest: PlaybookEvaluation | null = null

  for (const e of evaluations) {
    diagnostics.byStatus[e.status] += 1
    strengthSum += e.strength
    durationSum += e.diagnostics.evaluationDurationMs
    if (e.strength > max) { max = e.strength; strongest = e }
    if (e.strength < min) { min = e.strength; weakest = e }
    for (const label of e.missingConditions) {
      diagnostics.missingConditions[label] = (diagnostics.missingConditions[label] ?? 0) + 1
    }
  }

  diagnostics.readyCount = diagnostics.byStatus.READY
  diagnostics.waitingRetestCount = diagnostics.byStatus.WAITING_RETEST
  diagnostics.watchingCount = diagnostics.byStatus.WATCHING
  diagnostics.invalidatedCount = diagnostics.byStatus.INVALIDATED
  diagnostics.completedCount = diagnostics.byStatus.COMPLETED
  diagnostics.expiredCount = diagnostics.byStatus.EXPIRED
  diagnostics.averageStrength = Math.round((strengthSum / evaluations.length) * 10) / 10
  diagnostics.maxStrength = max
  diagnostics.minStrength = min
  diagnostics.strongest = strongest
  diagnostics.weakest = weakest
  diagnostics.totalEvaluationMs = Math.round(durationSum * 10) / 10
  diagnostics.evaluationDurationMs = diagnostics.totalEvaluationMs
  diagnostics.invariantFailures = evaluateInvariants(evaluations)

  return diagnostics
}

/**
 * Evaluate structural invariants over an evaluation (or history). Returns the
 * list of failed invariant descriptions (empty == all pass).
 */
export function evaluateInvariants(evaluations: PlaybookEvaluation[]): string[] {
  const failures: string[] = []
  for (const e of evaluations) {
    if (e.strength < 0 || e.strength > 100) {
      failures.push(`${e.id}: strength ${e.strength} outside [0, 100]`)
    }
    if (!PLAYBOOK_STATUSES.includes(e.status)) {
      failures.push(`${e.id}: invalid status ${e.status}`)
    }
    if (e.requiredChecks.length === 0) {
      failures.push(`${e.id}: no required checks`)
    }
    for (const check of e.requiredChecks) {
      if (!e.checks.some((c) => c.id === check.id)) {
        failures.push(`${e.id}: required check ${check.id} missing from checks`)
      }
    }
    if (e.requiredChecks.length > e.checks.length) {
      failures.push(`${e.id}: requiredChecks larger than checks`)
    }
    if (e.entryZone && e.entryZone.zone.top < e.entryZone.zone.bottom) {
      failures.push(`${e.id}: entry zone top < bottom`)
    }
    if (e.stopReference && e.entryZone && e.direction === 'long' && e.stopReference.price > e.entryZone.zone.bottom) {
      failures.push(`${e.id}: long stop not below entry zone`)
    }
    if (e.direction === 'neutral' && e.status === 'READY') {
      failures.push(`${e.id}: READY with neutral direction`)
    }
    for (let i = 1; i < e.eventChain.length; i++) {
      const prev = e.eventChain[i - 1]
      const cur = e.eventChain[i]
      if (cur.candleIndex < prev.candleIndex) {
        failures.push(`${e.id}: event chain out of order (${prev.label} → ${cur.label})`)
      }
    }
    if (isTerminalStatus(e.status) && e.nextExpectedEvent !== null) {
      failures.push(`${e.id}: terminal status with a next expected event`)
    }
    try {
      JSON.parse(e.serialized)
    } catch {
      failures.push(`${e.id}: serialized payload not valid JSON`)
    }
  }
  return failures
}

export function invariantFailuresFor(evaluation: PlaybookEvaluation): string[] {
  return evaluateInvariants([evaluation])
}

/** Definition-level diagnostics used by the Configure tab. */
export interface DefinitionStats {
  parameterCount: number
  requiredCheckCount: number
  optionalCheckCount: number
}

export function definitionStats(definition: PlaybookDefinition): DefinitionStats {
  return {
    parameterCount: definition.parameterSchema.length,
    requiredCheckCount: definition.checks.filter((c) => c.required).length,
    optionalCheckCount: definition.checks.filter((c) => !c.required).length,
  }
}

export type { PlaybookStatus }
