import type { AnalyzerContribution, IntelligenceScores, OpportunityLevel, RiskLevel } from '../types/index.js'

export function computeQualityScore(contributions: AnalyzerContribution[]): number {
  let weighted = 0
  let totalWeight = 0
  for (const c of contributions) {
    weighted += c.score * c.weight
    totalWeight += c.weight
  }
  return totalWeight > 0 ? Math.round((weighted / totalWeight) * 10) / 10 : 0
}

export function computeConfidence(eventConfidence: number, qualityScore: number): number {
  return Math.min(100, Math.round((eventConfidence * 0.4 + qualityScore * 0.6) * 10) / 10)
}

export function computeRiskScore(contributions: AnalyzerContribution[]): number {
  const risk = contributions.find((c) => c.analyzer === 'risk')
  return risk ? Math.round((100 - risk.score) * 10) / 10 : 50
}

export function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 75) return 'safe'
  if (score >= 50) return 'medium'
  if (score >= 25) return 'high'
  return 'extreme'
}

export function computeOpportunityScore(
  qualityScore: number,
  riskScore: number,
  eventConfidence: number,
): number {
  const raw = qualityScore * 0.5 + riskScore * 0.3 + eventConfidence * 0.2
  return Math.min(100, Math.round(raw * 10) / 10)
}

export function opportunityLevelFromScore(score: number): OpportunityLevel {
  if (score >= 85) return 'excellent'
  if (score >= 70) return 'high'
  if (score >= 50) return 'medium'
  if (score >= 30) return 'low'
  return 'very_low'
}

export function buildScores(
  contributions: AnalyzerContribution[],
  eventConfidence: number,
): IntelligenceScores {
  const qualityScore = computeQualityScore(contributions)
  const riskScore = computeRiskScore(contributions)
  const opportunityScore = computeOpportunityScore(qualityScore, riskScore, eventConfidence)
  return {
    qualityScore,
    confidence: computeConfidence(eventConfidence, qualityScore),
    riskScore,
    opportunityScore,
    opportunityLevel: opportunityLevelFromScore(opportunityScore),
    riskLevel: riskLevelFromScore(riskScore),
  }
}
