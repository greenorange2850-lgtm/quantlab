import { BaseRulePlugin } from '../core/base-rule-plugin.js'
import type { RuleContext, RuleDetection, RuleMetadata } from '../types/index.js'
import { ConfidenceEngine } from '../engine/confidence.engine.js'

export class FvgPlugin extends BaseRulePlugin {
  readonly metadata: RuleMetadata = {
    id: 'fvg',
    name: 'FVG',
    version: '1.0.0',
    description: 'Fair Value Gap — detects 3-candle imbalance gaps',
    author: 'system',
    priority: 75,
    dependencies: [],
    outputEvents: ['Bullish FVG', 'Bearish FVG'],
    tags: ['fvg', 'imbalance', 'gap'],
    parameters: BaseRulePlugin.params(
      { key: 'minGapPips', label: 'Min Gap (price units)', type: 'number', default: 0, min: 0 },
      { key: 'minGapPercent', label: 'Min Gap %', type: 'number', default: 0.0001, min: 0 },
    ),
  }

  detect(context: RuleContext): RuleDetection[] {
    const { candles, index } = context
    if (index < 2) return []

    const c0 = candles[index - 2]
    const c2 = candles[index]
    const minGap = this.param('minGapPips', 0)
    const minPct = this.param('minGapPercent', 0.0001)

    const bullishGap = c0.high < c2.low
    const bearishGap = c0.low > c2.high

    if (bullishGap) {
      const gap = c2.low - c0.high
      const gapPct = gap / c0.close
      if (gap >= minGap && gapPct >= minPct) {
        return [this.detection(context, 'bullish', 75, {
          gapSize: gap, gapTop: c2.low, gapBottom: c0.high, type: 'bullish_fvg',
        }, ['bullish-fvg', 'imbalance'], [index - 2, index - 1, index])]
      }
    }

    if (bearishGap) {
      const gap = c0.low - c2.high
      const gapPct = gap / c0.close
      if (gap >= minGap && gapPct >= minPct) {
        return [this.detection(context, 'bearish', 75, {
          gapSize: gap, gapTop: c0.low, gapBottom: c2.high, type: 'bearish_fvg',
        }, ['bearish-fvg', 'imbalance'], [index - 2, index - 1, index])]
      }
    }

    return []
  }

  confidence(detection: RuleDetection, context: RuleContext): number {
    const gap = (detection.metadata.gapSize as number) ?? 0
    const gapScore = Math.min(100, gap / context.candles[context.index].close * 10000)
    return ConfidenceEngine.calculate(detection, {
      pattern_strength: detection.rawScore,
      gap_size: gapScore,
    })
  }

  explain(detection: RuleDetection): string {
    const dir = detection.direction === 'bullish' ? 'Bullish' : 'Bearish'
    return `${dir} FVG at ${detection.timestamp} — gap size ${(detection.metadata.gapSize as number).toFixed(5)}`
  }
}
