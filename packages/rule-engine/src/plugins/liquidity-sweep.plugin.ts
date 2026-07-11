import { BaseRulePlugin } from '../core/base-rule-plugin.js'
import type { RuleContext, RuleDetection, RuleMetadata } from '../types/index.js'
import { findSwingHighs, findSwingLows } from '../utils/candle-math.js'
import { ConfidenceEngine } from '../engine/confidence.engine.js'

export class LiquiditySweepPlugin extends BaseRulePlugin {
  readonly metadata: RuleMetadata = {
    id: 'liquidity-sweep',
    name: 'Liquidity Sweep',
    version: '1.0.0',
    description: 'Detects sweeps of swing highs/lows with rejection',
    author: 'system',
    priority: 85,
    dependencies: [],
    outputEvents: ['Bullish Liquidity Sweep', 'Bearish Liquidity Sweep'],
    tags: ['liquidity', 'sweep', 'stop-hunt'],
    parameters: BaseRulePlugin.params(
      { key: 'swingLookback', label: 'Swing Lookback', type: 'number', default: 5, min: 2, max: 20 },
      { key: 'sweepTolerance', label: 'Sweep Tolerance %', type: 'number', default: 0.0002, min: 0 },
      { key: 'requireRejection', label: 'Require Rejection', type: 'boolean', default: true },
    ),
  }

  detect(context: RuleContext): RuleDetection[] {
    const { candles, index } = context
    const lookback = this.param('swingLookback', 5)
    const tolerance = this.param('sweepTolerance', 0.0002)
    const requireRejection = this.param('requireRejection', true)

    if (index < lookback * 2) return []

    const slice = candles.slice(0, index)
    const swingHighs = findSwingHighs(slice, lookback)
    const swingLows = findSwingLows(slice, lookback)
    const c = candles[index]

    const recentHigh = swingHighs.length ? swingHighs[swingHighs.length - 1] : -1
    const recentLow = swingLows.length ? swingLows[swingLows.length - 1] : -1

    if (recentHigh >= 0) {
      const level = candles[recentHigh].high
      const swept = c.high > level * (1 + tolerance) && c.close < level
      if (swept && (!requireRejection || c.close < c.open)) {
        return [this.detection(context, 'bearish', 81, {
          sweptLevel: level, sweepType: 'high', swingIndex: recentHigh,
        }, ['bearish-sweep', 'liquidity'], [recentHigh, index])]
      }
    }

    if (recentLow >= 0) {
      const level = candles[recentLow].low
      const swept = c.low < level * (1 - tolerance) && c.close > level
      if (swept && (!requireRejection || c.close > c.open)) {
        return [this.detection(context, 'bullish', 81, {
          sweptLevel: level, sweepType: 'low', swingIndex: recentLow,
        }, ['bullish-sweep', 'liquidity'], [recentLow, index])]
      }
    }

    return []
  }

  confidence(detection: RuleDetection): number {
    return ConfidenceEngine.calculate(detection, {
      pattern_strength: detection.rawScore,
      liquidity_proximity: 85,
    })
  }

  explain(detection: RuleDetection): string {
    const type = detection.metadata.sweepType as string
    return `Liquidity sweep of swing ${type} at ${detection.timestamp}`
  }
}
