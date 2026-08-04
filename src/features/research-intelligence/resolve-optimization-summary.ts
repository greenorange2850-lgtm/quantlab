import type {
  OptimizationResultSummary,
  ResearchReport,
} from '@/core/research'

/**
 * Resolve persisted adaptive optimization summary for UI display.
 * Prefers `report.optimization`; synthesizes a schemaVersion-0 stub when only
 * a baseline (or none) exists so legacy sessions render safely without
 * recomputing analytics.
 */
export function resolveOptimizationSummary(
  report: ResearchReport | null | undefined,
): OptimizationResultSummary | null {
  if (!report) return null
  if (report.optimization) return report.optimization

  if (!report.baseline && !report.bestCandidate) return null

  return {
    baseline: report.baseline ?? null,
    rawBestCandidateId: report.rawBestCandidate?.id ?? null,
    recommendedCandidateId:
      report.recommendedCandidate?.id ?? report.bestCandidate?.id ?? null,
    recommendation: {
      rawBestCandidateId: report.rawBestCandidate?.id ?? null,
      recommendedCandidateId:
        report.recommendedCandidate?.id ?? report.bestCandidate?.id ?? null,
      ruleId: 'raw_best',
      explanation: 'Legacy session without adaptive optimization metadata.',
    },
    stability: null,
    plateau: null,
    verdict: 'Insufficient Evidence',
    verdictDetail:
      'Adaptive baseline / stability data is unavailable for this legacy session.',
    improvements: [],
    metricChanges: [],
    parameterChanges: [],
    searchExplanation: {
      stagesCompleted: [],
      candidatesEvaluated: report.candidatesEvaluated,
      uniqueCandidates: report.candidatesEvaluated,
      duplicatesSkipped: 0,
      generatedCandidates: report.candidatesEvaluated,
      duplicateRate: 0,
      improvementCount: 0,
      lastImprovement: null,
      plateauDetail: null,
      stabilitySummary: null,
      spaceExhausted: false,
    },
    rejectionReasonCounts: {},
    datasetCandleCount: 0,
    datasetStartMs: null,
    datasetEndMs: null,
    stabilityIncomplete: true,
    schemaVersion: 0,
  }
}
