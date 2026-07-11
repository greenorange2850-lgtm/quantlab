import { BaseRulePlugin } from '../core/base-rule-plugin.js'
import type { RuleContext, RuleDetection, RuleMetadata } from '../types/index.js'
import { findSwingHighs, findSwingLows } from '../utils/candle-math.js'

export class MssPlugin extends BaseRulePlugin {
  readonly metadata: RuleMetadata = {
    id: 'mss',
    name: 'MSS',
    version: '1.0.0',
    description: 'Market Structure Shift — first break against prevailing structure',
    author: 'system',
    priority: 90,
    dependencies: [],
    outputEvents: ['Bullish MSS', 'Bearish MSS'],
    tags: ['mss', 'structure', 'shift'],
    parameters: BaseRulePlugin.params(
      { key: 'swingLookback', label: 'Swing Lookback', type: 'number', default: 5, min: 2, max: 20 },
    ),
  }

  detect(context: RuleContext): RuleDetection[] {
    const { candles, index } = context
    const lookback = this.param('swingLookback', 5)
    if (index < lookback * 3) return []

    const slice = candles.slice(0, index + 1)
    const highs = findSwingHighs(slice, lookback)
    const lows = findSwingLows(slice, lookback)
    if (highs.length < 2 || lows.length < 2) return []

    const prevHigh = candles[highs[highs.length - 2]].high
    const lastHigh = candles[highs[highs.length - 1]].high
    const prevLow = candles[lows[lows.length - 2]].low
    const lastLow = candles[lows[lows.length - 1]].low
    const c = candles[index]

    const wasBearish = lastHigh < prevHigh && lastLow < prevLow
    const wasBullish = lastHigh > prevHigh && lastLow > prevLow

    if (wasBearish && c.close > prevHigh) {
      return [this.detection(context, 'bullish', 88, {
        brokenLevel: prevHigh, structure: 'bearish_to_bullish',
      }, ['bullish-mss', 'structure'])]
    }

    if (wasBullish && c.close < prevLow) {
      return [this.detection(context, 'bearish', 88, {
        brokenLevel: prevLow, structure: 'bullish_to_bearish',
      }, ['bearish-mss', 'structure'])]
    }

    return []
  }

  explain(detection: RuleDetection): string {
    return `MSS ${detection.direction} at ${detection.timestamp} — structure shift detected`
  }
}
