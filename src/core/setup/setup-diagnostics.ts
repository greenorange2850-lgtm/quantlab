/**
 * Setup Engine diagnostics + lightweight invariants.
 */

import type {
  SetupConflict,
  SetupDiagnostics,
  SetupType,
  TradingSetup,
} from './setup-types'

export function emptySetupDiagnostics(durationMs = 0): SetupDiagnostics {
  return {
    created: 0,
    watching: 0,
    waitingRetest: 0,
    ready: 0,
    completed: 0,
    expired: 0,
    invalidated: 0,
    averageStrength: 0,
    conflictCount: 0,
    missingConditionCounts: {},
    byType: {},
    invariantFailures: 0,
    invariantDetails: [],
    durationMs,
    ok: true,
  }
}

export function buildSetupDiagnostics(
  setups: readonly TradingSetup[],
  conflicts: readonly SetupConflict[],
  durationMs: number,
): SetupDiagnostics {
  const missingConditionCounts: Record<string, number> = {}
  const byType: Partial<Record<SetupType, number>> = {}

  for (const s of setups) {
    byType[s.setupType] = (byType[s.setupType] ?? 0) + 1
    for (const m of s.missingChecks) {
      missingConditionCounts[m] = (missingConditionCounts[m] ?? 0) + 1
    }
  }

  const strengths = setups.map((s) => s.strength.score)
  const averageStrength =
    strengths.length === 0
      ? 0
      : strengths.reduce((a, b) => a + b, 0) / strengths.length

  const details: string[] = []
  let failures = 0

  for (const s of setups) {
    if (s.strength.score < 0 || s.strength.score > 100) {
      failures += 1
      details.push(`${s.id}: strength outside 0–100`)
    }
    if (s.status === 'READY' && s.entryZone == null) {
      failures += 1
      details.push(`${s.id}: READY without entry zone`)
    }
    if (s.status === 'READY' && s.stopReference == null) {
      failures += 1
      details.push(`${s.id}: READY without stop reference`)
    }
    if (
      s.status === 'READY' &&
      !s.setupType.includes('QML') &&
      s.requiredChecks.some(
        (c) =>
          c.required &&
          !c.passed &&
          c.name !== 'Conflict' &&
          c.name !== 'Trend' &&
          c.name !== 'Dow Theory',
      )
    ) {
      // Structural/entry required checks must pass for non-QML READY.
      // Conflict / soft trend context may be annotated after ranking.
      failures += 1
      details.push(`${s.id}: READY with failed required checks`)
    }
    if (s.createdIndex > s.updatedIndex) {
      failures += 1
      details.push(`${s.id}: createdIndex after updatedIndex`)
    }
  }

  // Duplicate id invariant
  const ids = new Set<string>()
  for (const s of setups) {
    if (ids.has(s.id)) {
      failures += 1
      details.push(`Duplicate setup id ${s.id}`)
    }
    ids.add(s.id)
  }

  return {
    created: setups.length,
    watching: setups.filter((s) => s.status === 'WATCHING').length,
    waitingRetest: setups.filter((s) => s.status === 'WAITING_RETEST').length,
    ready: setups.filter((s) => s.status === 'READY').length,
    completed: setups.filter((s) => s.status === 'COMPLETED').length,
    expired: setups.filter((s) => s.status === 'EXPIRED').length,
    invalidated: setups.filter((s) => s.status === 'INVALIDATED').length,
    averageStrength: Math.round(averageStrength * 10) / 10,
    conflictCount: conflicts.length,
    missingConditionCounts,
    byType,
    invariantFailures: failures,
    invariantDetails: details,
    durationMs,
    ok: failures === 0,
  }
}
