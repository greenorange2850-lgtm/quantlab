import { BaseAnalyzer } from './base.analyzer.js'
import type { AnalysisContext, StructureAnalysis } from '../types/index.js'
import { findSwingHighs, findSwingLows } from '../utils/math.js'

export class StructureAnalyzer extends BaseAnalyzer {
  readonly name = 'structure'
  readonly weight = 1.4

  analyze(context: AnalysisContext) {
    const analysis = this.compute(context)
    const tags: string[] = [`${analysis.structure}-structure`]
    if (analysis.lastBos !== 'none') tags.push(`${analysis.lastBos}-bos`)
    if (analysis.lastChoch !== 'none') tags.push(`${analysis.lastChoch}-choch`)

    let score = 55
    if (analysis.structure === context.event.direction) score = 78
    if (analysis.structure === 'ranging') score = 45

    return this.contribution(score, tags, { ...analysis })
  }

  compute(context: AnalysisContext): StructureAnalysis {
    const { candles, candleIndex, relatedEvents } = context
    const lookback = 5
    const slice = candles.slice(0, candleIndex + 1)
    const highs = findSwingHighs(slice, lookback)
    const lows = findSwingLows(slice, lookback)

    let structure: StructureAnalysis['structure'] = 'ranging'
    if (highs.length >= 2 && lows.length >= 2) {
      const hh = candles[highs[highs.length - 1]].high > candles[highs[highs.length - 2]].high
      const hl = candles[lows[lows.length - 1]].low > candles[lows[lows.length - 2]].low
      const lh = candles[highs[highs.length - 1]].high < candles[highs[highs.length - 2]].high
      const ll = candles[lows[lows.length - 1]].low < candles[lows[lows.length - 2]].low
      if (hh && hl) structure = 'bullish'
      else if (lh && ll) structure = 'bearish'
    }

    const bosEvent = relatedEvents.find((e) => e.ruleName.toLowerCase().includes('bos'))
    const chochEvent = relatedEvents.find((e) => e.ruleName.toLowerCase().includes('choch'))

    return {
      structure,
      lastBos: bosEvent ? (bosEvent.direction === 'bullish' ? 'bullish' : 'bearish') : 'none',
      lastChoch: chochEvent ? (chochEvent.direction === 'bullish' ? 'bullish' : 'bearish') : 'none',
    }
  }
}
