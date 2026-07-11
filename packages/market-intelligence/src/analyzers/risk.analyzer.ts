import { BaseAnalyzer } from './base.analyzer.js'
import type { AnalysisContext, RiskAnalysis, RiskLevel } from '../types/index.js'

export class RiskAnalyzer extends BaseAnalyzer {
  readonly name = 'risk'
  readonly weight = 1.2

  analyze(context: AnalysisContext) {
    const analysis = this.compute(context)
    const tags = analysis.factors.map((f) => f.toLowerCase().replace(/\s+/g, '-'))
    const score = 100 - analysis.score

    return this.contribution(score, tags, { ...analysis })
  }

  compute(context: AnalysisContext): RiskAnalysis {
    const factors: string[] = []
    let riskPoints = 0

    const c = context.candles[context.candleIndex]
    if ((c.spread ?? 0) > 0) {
      const avgSpread = context.candles.slice(-20).reduce((s, x) => s + (x.spread ?? 0), 0) / 20
      if ((c.spread ?? 0) > avgSpread * 1.5) { riskPoints += 25; factors.push('High Spread') }
    }

    if (context.event.confidence < 60) { riskPoints += 20; factors.push('Low Event Confidence') }

    const offHours = context.candles[context.candleIndex].session === 'off_hours'
    if (offHours) { riskPoints += 15; factors.push('Off Hours') }

    const againstTrend = context.relatedEvents.length === 0
    if (againstTrend) { riskPoints += 10; factors.push('Limited Context') }

    const level: RiskLevel =
      riskPoints >= 60 ? 'extreme' :
      riskPoints >= 40 ? 'high' :
      riskPoints >= 20 ? 'medium' : 'safe'

    return { level, score: Math.min(100, riskPoints), factors }
  }
}
