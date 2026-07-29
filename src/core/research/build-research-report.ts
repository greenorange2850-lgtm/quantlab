import type { ResearchReport, ResearchSession } from './types.js'

/**
 * Build a research report from a completed (or terminal) Random Search session.
 * Uses candidate scores already derived from BacktestReport — no UI recomputation.
 */
export function buildResearchReport(
  session: ResearchSession,
  topN = 10,
): ResearchReport {
  const passing = session.candidates.filter((candidate) => candidate.passedConstraints)
  const ranked = [...passing].sort((a, b) => b.score - a.score)
  const best =
    (session.bestCandidateId
      ? session.candidates.find((candidate) => candidate.id === session.bestCandidateId)
      : null) ?? ranked[0] ?? null

  return {
    sessionId: session.id,
    status: session.status,
    objective: session.config.objective,
    iterationsRequested: session.config.iterations,
    iterationsCompleted: session.progress.completed,
    candidatesEvaluated: session.candidates.length,
    candidatesPassingConstraints: passing.length,
    bestCandidate: best,
    topCandidates: ranked.slice(0, topN),
    config: session.config,
    error: session.error,
    createdAt: session.createdAt,
    completedAt: session.completedAt,
  }
}
