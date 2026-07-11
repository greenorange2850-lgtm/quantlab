import { BaseAnalyzer } from './base.analyzer.js'
import type { AnalysisContext, SpreadAnalysis } from '../types/index.js'

export class SpreadAnalyzer extends BaseAnalyzer {
  readonly name = 'spread'
  readonly weight = 0.9

  analyze(context: AnalysisContext) {
    const analysis = this.compute(context)
    const tags: string[] = []
    if (analysis.isHigh) tags.push('high-spread')
    else tags.push('low-spread')

    const score = analysis.isHigh ? 35 : 75

    return this.contribution(score, tags, { ...analysis })
  }

  compute(context: AnalysisContext): SpreadAnalysis {
    const { candles, candleIndex } = context
    const c = candles[candleIndex]
    const current = c.spread ?? 0

    const start = Math.max(0, candleIndex - 20)
    let sum = 0
    let count = 0
    for (let i = start; i <= candleIndex; i++) {
      const s = candles[i].spread ?? 0
      if (s > 0) { sum += s; count++ }
    }
    const average = count > 0 ? sum / count : current
    const ratio = average > 0 ? current / average : 1
    const isHigh = ratio > 1.5 || current > average * 1.5

    return { current, average, ratio, isHigh }
  }
}
