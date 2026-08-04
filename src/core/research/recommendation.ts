import type { RandomSearchCandidate, RecommendationDecision, StabilityResult } from './types.js'

/**
 * Choose recommended vs raw-best using documented deterministic rules.
 *
 * Rules (in order):
 * 1. No eligible → none_eligible
 * 2. If stability is HIGH or MEDIUM and a slightly lower eligible neighbor/top
 *    candidate has ≥15% more trades and score within 8% of raw best → larger_sample
 * 3. If raw best has LOW stability and another eligible candidate within 5% score
 *    has HIGH/MEDIUM stability → stable_neighborhood
 * 4. Otherwise → raw_best
 *
 * Uses only existing scores, trade counts, constraint flags, and stability output.
 */
export function selectRecommendedCandidate(input: {
  eligibleRanked: RandomSearchCandidate[]
  rawBest: RandomSearchCandidate | null
  rawBestStability: StabilityResult | null
  candidateStability?: Map<string, StabilityResult>
}): RecommendationDecision {
  const { eligibleRanked, rawBest, rawBestStability, candidateStability } = input

  if (!rawBest || eligibleRanked.length === 0) {
    return {
      rawBestCandidateId: null,
      recommendedCandidateId: null,
      ruleId: 'none_eligible',
      explanation:
        'No candidates passed the configured constraints, so no recommendation is available.',
    }
  }

  const rawId = rawBest.id

  // Prefer a more heavily sampled near-best when raw peak looks thin.
  if (rawBestStability && (rawBestStability.overall === 'LOW' || rawBestStability.overall === 'MEDIUM')) {
    for (const candidate of eligibleRanked) {
      if (candidate.id === rawId) continue
      const scoreGap =
        Math.abs(rawBest.score) > 1e-9
          ? (rawBest.score - candidate.score) / Math.abs(rawBest.score)
          : Math.abs(rawBest.score - candidate.score)
      if (scoreGap > 0.08) continue
      if (candidate.report.summary.totalTrades < rawBest.report.summary.totalTrades * 1.15) {
        continue
      }
      const stab = candidateStability?.get(candidate.id)
      if (stab && (stab.overall === 'HIGH' || stab.overall === 'MEDIUM')) {
        return {
          rawBestCandidateId: rawId,
          recommendedCandidateId: candidate.id,
          ruleId: 'larger_sample',
          explanation: `Candidate ${rawId} had the highest raw score (${rawBest.score.toFixed(2)}), but Candidate ${candidate.id} is recommended because it stayed within 8% of the peak, had a larger trade sample (${candidate.report.summary.totalTrades} vs ${rawBest.report.summary.totalTrades}), and showed ${stab.overall.toLowerCase()} neighborhood stability.`,
        }
      }
      if (!stab && candidate.report.summary.totalTrades >= rawBest.report.summary.totalTrades * 1.25) {
        return {
          rawBestCandidateId: rawId,
          recommendedCandidateId: candidate.id,
          ruleId: 'larger_sample',
          explanation: `Candidate ${rawId} had the highest raw score (${rawBest.score.toFixed(2)}), but Candidate ${candidate.id} is recommended because it stayed within 8% of the peak and had a larger sample size (${candidate.report.summary.totalTrades} vs ${rawBest.report.summary.totalTrades}).`,
        }
      }
    }
  }

  if (rawBestStability?.overall === 'LOW') {
    for (const candidate of eligibleRanked) {
      if (candidate.id === rawId) continue
      const scoreGap =
        Math.abs(rawBest.score) > 1e-9
          ? (rawBest.score - candidate.score) / Math.abs(rawBest.score)
          : Math.abs(rawBest.score - candidate.score)
      if (scoreGap > 0.05) continue
      const stab = candidateStability?.get(candidate.id)
      if (stab && (stab.overall === 'HIGH' || stab.overall === 'MEDIUM')) {
        return {
          rawBestCandidateId: rawId,
          recommendedCandidateId: candidate.id,
          ruleId: 'stable_neighborhood',
          explanation: `Candidate ${rawId} had the highest raw score, but Candidate ${candidate.id} is recommended because nearby parameter variations remained ${stab.overall === 'HIGH' ? 'stable' : 'moderately stable'} while the raw peak was sensitive.`,
        }
      }
    }
  }

  return {
    rawBestCandidateId: rawId,
    recommendedCandidateId: rawId,
    ruleId: 'raw_best',
    explanation: `Candidate ${rawId} is recommended as the highest eligible objective score${
      rawBestStability ? ` with ${rawBestStability.overall.toLowerCase().replace('_', ' ')} stability` : ''
    }.`,
  }
}
