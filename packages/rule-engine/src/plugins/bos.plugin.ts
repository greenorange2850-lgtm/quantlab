import { BaseRulePlugin } from '../core/base-rule-plugin.js'
import type { RuleContext, RuleDetection, RuleMetadata } from '../types/index.js'
import { findSwingHighs, findSwingLows } from '../utils/candle-math.js'

export class BosPlugin extends BaseRulePlugin {
  readonly metadata: RuleMetadata = {
    id: 'bos',
    name: 'BOS',
    version: '1.0.0',
    description: 'Break of Structure — continuation break in trend direction',
    author: 'system',
    priority: 85,
    dependencies: [],
    outputEvents: ['Bullish BOS', 'Bearish BOS'],
    tags: ['bos', 'structure', 'continuation'],
    parameters: BaseRulePlugin.params(
      { key: 'swingLookback', label: 'Swing Lookback', type: 'number', default: 5, min: 2, max: 20 },
    ),
  }

  detect(context: RuleContext): RuleDetection[] {
    const { candles, index } = context
    const lookback = this.param('swingLookback', 5)
    if (index < lookback * 2) return []

    const slice = candles.slice(0, index + 1)
    const highs = findSwingHighs(slice, lookback)
    const lows = findSwingLows(slice, lookback)
    const c = candles[index]

    if (highs.length >= 1) {
      const lastHighIdx = highs[highs.length - 1]
      const level = candles[lastHighIdx].high
      if (c.close > level && c.close > c.open) {
        return [this.detection(context, 'bullish', 82, {
          brokenLevel: level, bosType: 'bullish_continuation',
        }, ['bullish-bos', 'structure'])]
      }
    }

    if (lows.length >= 1) {
      const lastLowIdx = lows[lows.length - 1]
      const level = candles[lastLowIdx].low
      if (c.close < level && c.close < c.open) {
        return [this.detection(context, 'bearish', 82, {
          brokenLevel: level, bosType: 'bearish_continuation',
        }, ['bearish-bos', 'structure'])]
      }
    }

    return []
  }

  explain(detection: RuleDetection): string {
    return `BOS ${detection.direction} at ${detection.timestamp}`
  }
}
