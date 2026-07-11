import { BaseAnalyzer } from './base.analyzer.js'
import type { AnalysisContext, MtfAnalysis, TimeframeCode } from '../types/index.js'
import { TIMEFRAME_HIERARCHY } from '../types/index.js'
import { trendFromCloses } from '../utils/math.js'

const HTF_CHAIN: Record<string, TimeframeCode[]> = {
  M1: ['M15', 'H1', 'H4'], M5: ['M15', 'H1', 'H4'], M15: ['H1', 'H4', 'D1'],
  M30: ['H4', 'D1'], H1: ['H4', 'D1', 'W1'], H4: ['D1', 'W1'], D1: ['W1', 'MN'],
  W1: ['MN'], MN: [],
}

export class MtfAnalyzer extends BaseAnalyzer {
  readonly name = 'mtf'
  readonly weight = 1.5

  analyze(context: AnalysisContext) {
    const analysis = this.compute(context)
    const tags: string[] = []
    if (analysis.alignment === 'aligned') tags.push('htf-aligned')
    if (analysis.alignment === 'conflicted') tags.push('against-htf')
    if (analysis.alignment === 'neutral') tags.push('htf-neutral')

    const score = analysis.alignment === 'aligned' ? 85
      : analysis.alignment === 'conflicted' ? 30 : 55

    return this.contribution(score, tags, { ...analysis })
  }

  compute(context: AnalysisContext): MtfAnalysis {
    const { timeframe, event, htfCandles } = context
    const chain = HTF_CHAIN[timeframe] ?? ['H4', 'D1']
    const trends: Record<string, MtfAnalysis['trends'][string]> = {}
    const conflictingTimeframes: string[] = []

    for (const tf of chain) {
      const candles = htfCandles[tf]
      if (!candles?.length) continue
      const closes = candles.slice(-20).map((c) => c.close)
      const { direction } = trendFromCloses(closes)
      trends[tf] = direction

      if (event.direction === 'bullish' && direction === 'bearish') conflictingTimeframes.push(tf)
      if (event.direction === 'bearish' && direction === 'bullish') conflictingTimeframes.push(tf)
    }

    const values = Object.values(trends)
    let alignment: MtfAnalysis['alignment'] = 'neutral'
    if (values.length > 0) {
      const bullish = values.filter((d) => d === 'bullish').length
      const bearish = values.filter((d) => d === 'bearish').length
      const eventBull = event.direction === 'bullish'
      const eventBear = event.direction === 'bearish'
      if ((eventBull && bullish > bearish) || (eventBear && bearish > bullish)) alignment = 'aligned'
      else if (conflictingTimeframes.length > 0) alignment = 'conflicted'
    }

    return { alignment, trends, conflictingTimeframes }
  }
}
