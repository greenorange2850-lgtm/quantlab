import { BaseRulePlugin } from '../core/base-rule-plugin.js'
import type { RuleContext, RuleDetection, RuleMetadata } from '../types/index.js'
import { findSwingHighs, findSwingLows } from '../utils/candle-math.js'

export class ChochPlugin extends BaseRulePlugin {
  readonly metadata: RuleMetadata = {
    id: 'choch',
    name: 'CHOCH',
    version: '1.0.0',
    description: 'Change of Character — early structure reversal signal',
    author: 'system',
    priority: 88,
    dependencies: ['mss'],
    outputEvents: ['Bullish CHOCH', 'Bearish CHOCH'],
    tags: ['choch', 'structure', 'reversal'],
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

    if (highs.length >= 2) {
      const prev = candles[highs[highs.length - 2]]
      const last = candles[highs[highs.length - 1]]
      if (last.high < prev.high && c.close > last.high) {
        return [this.detection(context, 'bullish', 86, {
          characterChange: 'lower_high_broken', level: last.high,
        }, ['bullish-choch', 'reversal'])]
      }
    }

    if (lows.length >= 2) {
      const prev = candles[lows[lows.length - 2]]
      const last = candles[lows[lows.length - 1]]
      if (last.low > prev.low && c.close < last.low) {
        return [this.detection(context, 'bearish', 86, {
          characterChange: 'higher_low_broken', level: last.low,
        }, ['bearish-choch', 'reversal'])]
      }
    }

    return []
  }

  explain(detection: RuleDetection): string {
    return `CHOCH ${detection.direction} at ${detection.timestamp}`
  }
}
