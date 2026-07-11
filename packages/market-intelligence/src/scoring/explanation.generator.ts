import type {
  AnalyzerContribution,
  IntelligenceScores,
  Recommendation,
  StructuredExplanation,
  MarketConditionSnapshot,
} from '../types/index.js'
import type { TrendAnalyzer } from '../analyzers/trend.analyzer.js'
import type { VolatilityAnalyzer } from '../analyzers/volatility.analyzer.js'
import type { LiquidityAnalyzer } from '../analyzers/liquidity.analyzer.js'
import type { SessionAnalyzer } from '../analyzers/session.analyzer.js'
import type { SpreadAnalyzer } from '../analyzers/spread.analyzer.js'
import type { MomentumAnalyzer } from '../analyzers/momentum.analyzer.js'
import type { RangeAnalyzer } from '../analyzers/range.analyzer.js'
import type { StructureAnalyzer } from '../analyzers/structure.analyzer.js'
import type { MtfAnalyzer } from '../analyzers/mtf.analyzer.js'
import type { RiskAnalyzer } from '../analyzers/risk.analyzer.js'

const SESSION_LABELS: Record<string, string> = {
  asian: 'Asian Session',
  london: 'London Session',
  new_york: 'New York Session',
  overlap: 'London/NY Overlap',
  off_hours: 'Off Hours',
}

export function generateExplanation(
  scores: IntelligenceScores,
  contributions: AnalyzerContribution[],
  eventName: string,
): StructuredExplanation {
  const reasons: string[] = []
  const warnings: string[] = []

  for (const c of contributions) {
    if (c.score >= 70) {
      if (c.analyzer === 'mtf' && c.tags.includes('htf-aligned')) reasons.push('HTF aligned')
      if (c.analyzer === 'session') {
        const session = c.metadata.session as string
        if (session) reasons.push(SESSION_LABELS[session] ?? session)
      }
      if (c.analyzer === 'trend' && c.tags.includes('strong-trend')) reasons.push('Strong trend')
      if (c.analyzer === 'spread' && c.tags.includes('low-spread')) reasons.push('Low spread')
      if (c.analyzer === 'liquidity' && c.tags.includes('sweep-likely')) reasons.push('Liquidity sweep context')
      if (c.analyzer === 'structure') reasons.push('Structure confirmation')
    }
    if (c.score < 45) {
      if (c.analyzer === 'mtf' && c.tags.includes('against-htf')) warnings.push('Against HTF')
      if (c.analyzer === 'spread' && c.tags.includes('high-spread')) warnings.push('High spread')
      if (c.analyzer === 'volatility' && c.tags.includes('compression')) warnings.push('Volatility compression')
      if (c.analyzer === 'risk') warnings.push(...(c.metadata.factors as string[] ?? []))
    }
  }

  if (eventName.toLowerCase().includes('fvg')) reasons.push('FVG confirmation')
  if (eventName.toLowerCase().includes('liquidity')) reasons.push('Liquidity sweep')

  const verdict =
    scores.qualityScore >= 75 ? 'high_quality' :
    scores.qualityScore >= 55 ? 'medium_quality' :
    scores.qualityScore >= 35 ? 'low_quality' : 'poor_quality'

  const verdictLabel = verdict.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const summary = `${verdictLabel} — ${eventName} with ${scores.opportunityLevel.replace('_', ' ')} opportunity and ${scores.riskLevel} risk`

  return { verdict, summary, reasons: [...new Set(reasons)], warnings: [...new Set(warnings)] }
}

export function generateRecommendations(
  scores: IntelligenceScores,
  contributions: AnalyzerContribution[],
): Recommendation[] {
  const recs: Recommendation[] = []

  if (scores.opportunityLevel === 'excellent' || scores.opportunityLevel === 'high') {
    recs.push({ type: 'favorable', message: 'Conditions favor this setup', priority: 1 })
  }
  if (scores.riskLevel === 'high' || scores.riskLevel === 'extreme') {
    recs.push({ type: 'avoid', message: 'Elevated risk — reduce size or skip', priority: 1 })
  }
  const mtf = contributions.find((c) => c.analyzer === 'mtf')
  if (mtf?.tags.includes('against-htf')) {
    recs.push({ type: 'caution', message: 'Event conflicts with higher timeframe trend', priority: 2 })
  }
  const spread = contributions.find((c) => c.analyzer === 'spread')
  if (spread?.tags.includes('high-spread')) {
    recs.push({ type: 'caution', message: 'Wide spread reduces edge', priority: 3 })
  }
  if (recs.length === 0) {
    recs.push({ type: 'neutral', message: 'No strong signal — await better confluence', priority: 5 })
  }

  return recs.sort((a, b) => a.priority - b.priority)
}

export function collectContextTags(contributions: AnalyzerContribution[]): string[] {
  const tags = new Set<string>()
  for (const c of contributions) {
    for (const t of c.tags) tags.add(t)
  }
  return [...tags]
}

export function buildConditionSnapshot(
  trend: TrendAnalyzer,
  volatility: VolatilityAnalyzer,
  liquidity: LiquidityAnalyzer,
  session: SessionAnalyzer,
  spread: SpreadAnalyzer,
  momentum: MomentumAnalyzer,
  range: RangeAnalyzer,
  structure: StructureAnalyzer,
  mtf: MtfAnalyzer,
  risk: RiskAnalyzer,
  context: Parameters<TrendAnalyzer['compute']>[0],
): MarketConditionSnapshot {
  return {
    trend: trend.compute(context),
    volatility: volatility.compute(context),
    liquidity: liquidity.compute(context),
    session: session.compute(context),
    spread: spread.compute(context),
    momentum: momentum.compute(context),
    range: range.compute(context),
    structure: structure.compute(context),
    mtf: mtf.compute(context),
    risk: risk.compute(context),
  }
}
