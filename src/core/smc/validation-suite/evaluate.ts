import type { Candle } from '@/data/candles'
import type { SmcDetectionResult, SmcDetectorConfig } from '../types'
import { matchGoldenLabels, validationModuleForKind } from './matching'
import { buildModuleMetrics, SMC_VALIDATION_MODULES } from './metrics'
import { toDetectedProbes } from './probes'
import { validateProgressiveConsistency } from './progressive'
import type {
  SmcEventMatchTolerance,
  SmcGoldenDataset,
  SmcGoldenLabel,
  SmcValidationModule,
  SmcValidationReport,
  SmcWrongTagCount,
} from './types'
import { DEFAULT_SMC_MATCH_TOLERANCE } from './types'

export interface SmcReviewSample {
  eventId: string
  kind: string
  module: SmcValidationModule | null
  verdict: 'correct' | 'wrong' | 'unsure'
  reasonTags: string[]
  configFingerprint: string
  detectorVersion: string
}

export interface EvaluateValidationInput {
  dataset: SmcGoldenDataset
  detection: SmcDetectionResult
  /** Optional candles + config for progressive/look-ahead checks. */
  candles?: readonly Candle[]
  config?: SmcDetectorConfig
  reviews?: readonly SmcReviewSample[]
  tolerance?: SmcEventMatchTolerance
}

/**
 * Build a validation report from golden labels + current detection.
 * Uses only reviewed / golden samples — never claims universal correctness.
 */
export function evaluateSmcValidation(input: EvaluateValidationInput): SmcValidationReport {
  const tolerance = input.tolerance ?? DEFAULT_SMC_MATCH_TOLERANCE
  const probes = toDetectedProbes(input.detection)
  const { matched, missed, extra } = matchGoldenLabels(
    input.dataset.labels,
    probes,
    tolerance,
  )

  const reviews = (input.reviews ?? []).filter(
    (r) =>
      r.configFingerprint === input.dataset.configFingerprint &&
      r.detectorVersion === input.dataset.detectorVersion,
  )

  const modules = SMC_VALIDATION_MODULES.map((module) => {
    const moduleMatched = matched.filter((m) => m.module === module)
    const moduleMissed = missed.filter((l) => l.module === module)
    const moduleExtra = extra.filter((e) => validationModuleForKind(e.kind) === module)

    const moduleReviews = reviews.filter((r) => r.module === module)
    const reviewedCorrect = moduleReviews.filter((r) => r.verdict === 'correct').length
    const reviewedWrong = moduleReviews.filter((r) => r.verdict === 'wrong').length
    const unsureCount = moduleReviews.filter((r) => r.verdict === 'unsure').length

    // Prefer golden-label TP/FP/FN when labels exist for the module; otherwise
    // fall back to review agreement as a soft sample (FP=wrong, TP=correct, FN=0).
    const hasGolden = input.dataset.labels.some((l) => l.module === module)
    const truePositives = hasGolden ? moduleMatched.length : reviewedCorrect
    const falsePositives = hasGolden ? moduleExtra.length : reviewedWrong
    const falseNegatives = hasGolden ? moduleMissed.length : 0

    return buildModuleMetrics({
      module,
      truePositives,
      falsePositives,
      falseNegatives,
      reviewedCorrect,
      reviewedWrong,
      unsureCount,
    })
  })

  const tagCounts = new Map<string, number>()
  for (const review of reviews) {
    if (review.verdict !== 'wrong') continue
    for (const tag of review.reasonTags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }
  for (const label of input.dataset.labels) {
    for (const tag of label.reasonTags ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
    }
  }
  const wrongReasonTags: SmcWrongTagCount[] = [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))

  let worstModule: SmcValidationModule | null = null
  let worstPrecision = Number.POSITIVE_INFINITY
  for (const m of modules) {
    if (m.reviewedSampleCount === 0 && m.truePositives + m.falsePositives === 0) continue
    const p = m.precision ?? m.reviewedAgreement
    if (p == null) continue
    if (p < worstPrecision) {
      worstPrecision = p
      worstModule = m.module
    }
  }

  const progressive =
    input.candles && input.config
      ? validateProgressiveConsistency(input.candles, input.config)
      : null

  const invariantFailures = input.detection.diagnostics.invariants
    ? Object.entries(input.detection.diagnostics.invariants)
        .filter(([k, v]) => k !== 'ok' && typeof v === 'number')
        .reduce((sum, [, v]) => sum + (v as number), 0)
    : 0

  const reviewedSampleCount = reviews.length

  return {
    datasetId: input.dataset.id,
    datasetName: input.dataset.name,
    detectorVersion: input.dataset.detectorVersion,
    configFingerprint: input.dataset.configFingerprint,
    profileId: input.dataset.profileId,
    reviewedSampleCount,
    modules,
    matched,
    missed,
    extra,
    wrongReasonTags,
    progressive,
    invariantFailures,
    worstModule,
    generatedAt: Date.now(),
  }
}

/** Promote a correct review / detected event into a golden label. */
export function goldenLabelFromProbe(
  probe: {
    id: string
    kind: import('../types').SmcDetectionKind
    candleIndex: number
    timestamp: number
    price: number
    sourceStructureId?: string | null
  },
  overrides?: Partial<SmcGoldenLabel>,
): SmcGoldenLabel {
  const module = validationModuleForKind(probe.kind)
  if (!module) {
    throw new Error(`Cannot create golden label for kind ${probe.kind}`)
  }
  return {
    id: overrides?.id ?? `golden-${probe.id}`,
    kind: probe.kind,
    module,
    candleIndex: probe.candleIndex,
    timestamp: probe.timestamp,
    price: probe.price,
    sourceStructureId: probe.sourceStructureId ?? null,
    note: overrides?.note,
    reasonTags: overrides?.reasonTags,
    createdAt: overrides?.createdAt ?? Date.now(),
  }
}

export function createGoldenDatasetId(scope: {
  datasetKey: string
  detectorVersion: string
  configFingerprint: string
}): string {
  const fp = scope.configFingerprint.slice(0, 24)
  return `golden-${scope.datasetKey}-${scope.detectorVersion}-${fp}`.replace(
    /[^a-zA-Z0-9._:-]+/g,
    '_',
  )
}
