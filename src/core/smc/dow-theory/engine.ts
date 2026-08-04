import type { SmcClassifiedSwingEvent } from '../types'
import { classifyDowSwingProgression } from './classify-swings'
import { inferDowTrend } from './infer-trend'
import {
  SMC_DOW_THEORY_VERSION,
  type DowSwingLabel,
  type DowTheoryClassifiedSwing,
  type SmcDowTheoryDiagnostics,
  type SmcDowTheoryLayer,
  type SmcDowTheorySnapshot,
  type SmcDowSwingMeta,
} from './types'

function buildDiagnostics(
  metas: readonly SmcDowSwingMeta[],
  trend: SmcDowTheoryLayer['trend'],
  strength: number,
  structurePhase: SmcDowTheoryLayer['structurePhase'],
): SmcDowTheoryDiagnostics {
  let hhCount = 0
  let hlCount = 0
  let lhCount = 0
  let llCount = 0
  for (const m of metas) {
    if (m.label === 'HH') hhCount += 1
    else if (m.label === 'HL') hlCount += 1
    else if (m.label === 'LH') lhCount += 1
    else if (m.label === 'LL') llCount += 1
  }
  return {
    hhCount,
    hlCount,
    lhCount,
    llCount,
    currentTrend: trend,
    trendStrength: strength,
    structurePhase,
  }
}

function latestOf(
  metas: readonly SmcDowSwingMeta[],
  layer: 'INTERNAL' | 'EXTERNAL',
): SmcDowSwingMeta | null {
  for (let i = metas.length - 1; i >= 0; i -= 1) {
    if (metas[i]!.classification === layer) return metas[i]!
  }
  return null
}

/**
 * Analyze Dow Theory from classified swings only.
 * Pure / deterministic. Does not mutate swing objects.
 * Only swings with confirmedAtIndex <= visibleThroughIndex are used (no look-ahead).
 */
export function analyzeDowTheory(
  classifiedSwings: readonly DowTheoryClassifiedSwing[],
  visibleThroughIndex: number,
): SmcDowTheoryLayer {
  const visibleIndex = Math.max(0, visibleThroughIndex)
  // Shallow copy of ids only — never mutate source objects.
  const sourceSwingIds = classifiedSwings.map((s) => s.id)
  const metas = classifyDowSwingProgression(classifiedSwings, visibleIndex)
  const inference = inferDowTrend(metas)

  const swingClassification: Record<string, DowSwingLabel | null> = {}
  const bySwingId: Record<string, SmcDowSwingMeta> = {}
  for (const meta of metas) {
    swingClassification[meta.swingId] = meta.label
    bySwingId[meta.swingId] = meta
  }

  const diagnostics = buildDiagnostics(
    metas,
    inference.trend,
    inference.strength,
    inference.structurePhase,
  )

  return {
    version: SMC_DOW_THEORY_VERSION,
    visibleThroughIndex: visibleIndex,
    trend: inference.trend,
    strength: inference.strength,
    structurePhase: inference.structurePhase,
    swingClassification,
    latestExternalSwing: latestOf(metas, 'EXTERNAL'),
    latestInternalSwing: latestOf(metas, 'INTERNAL'),
    swings: metas,
    bySwingId,
    diagnostics,
    sourceSwingIds,
  }
}

/** Convenience: public snapshot fields only. */
export function toDowTheorySnapshot(layer: SmcDowTheoryLayer): SmcDowTheorySnapshot {
  return {
    trend: layer.trend,
    strength: layer.strength,
    structurePhase: layer.structurePhase,
    swingClassification: { ...layer.swingClassification },
    latestExternalSwing: layer.latestExternalSwing,
    latestInternalSwing: layer.latestInternalSwing,
  }
}

/**
 * Attach Dow Theory layer onto a detection-shaped object without mutating swings.
 */
export function applyDowTheoryLayer<
  T extends {
    classifiedSwings: readonly SmcClassifiedSwingEvent[]
    diagnostics: { dowTheory?: SmcDowTheoryDiagnostics }
  },
>(
  result: T,
  visibleThroughIndex: number,
): T & { dowTheory: SmcDowTheoryLayer } {
  const dowTheory = analyzeDowTheory(result.classifiedSwings, visibleThroughIndex)
  return {
    ...result,
    dowTheory,
    diagnostics: {
      ...result.diagnostics,
      dowTheory: dowTheory.diagnostics,
    },
  }
}

/** Empty layer for idle / empty detection results. */
export function emptyDowTheoryLayer(
  visibleThroughIndex = 0,
): SmcDowTheoryLayer {
  return {
    version: SMC_DOW_THEORY_VERSION,
    visibleThroughIndex,
    trend: 'Unknown',
    strength: 0,
    structurePhase: 'INSUFFICIENT',
    swingClassification: {},
    latestExternalSwing: null,
    latestInternalSwing: null,
    swings: [],
    bySwingId: {},
    diagnostics: {
      hhCount: 0,
      hlCount: 0,
      lhCount: 0,
      llCount: 0,
      currentTrend: 'Unknown',
      trendStrength: 0,
      structurePhase: 'INSUFFICIENT',
    },
    sourceSwingIds: [],
  }
}
