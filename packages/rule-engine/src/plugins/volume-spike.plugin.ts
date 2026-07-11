import { BaseRulePlugin } from '../core/base-rule-plugin.js'
import type { RuleContext, RuleDetection, RuleMetadata } from '../types/index.js'
import { averageVolume, isBullish, isBearish } from '../utils/candle-math.js'
import { ConfidenceEngine } from '../engine/confidence.engine.js'

export class VolumeSpikePlugin extends BaseRulePlugin {
  readonly metadata: RuleMetadata = {
    id: 'volume-spike',
    name: 'Volume Spike',
    version: '1.0.0',
    description: 'Detects abnormal volume spikes relative to recent average',
    author: 'system',
    priority: 55,
    dependencies: [],
    outputEvents: ['Volume Spike Bullish', 'Volume Spike Bearish'],
    tags: ['volume', 'spike', 'momentum'],
    parameters: BaseRulePlugin.params(
      { key: 'volumeMultiplier', label: 'Volume Multiplier', type: 'number', default: 2.0, min: 1.2, max: 10 },
      { key: 'avgPeriod', label: 'Average Period', type: 'number', default: 20, min: 5, max: 100 },
    ),
  }

  detect(context: RuleContext): RuleDetection[] {
    const { candles, index } = context
    const mult = this.param('volumeMultiplier', 2.0)
    const period = this.param('avgPeriod', 20)
    if (index < period) return []

    const c = candles[index]
    const avgVol = averageVolume(candles, index - 1, period)
    if (avgVol === 0 || c.volume < avgVol * mult) return []

    const ratio = c.volume / avgVol
    const direction = isBullish(c) ? 'bullish' : isBearish(c) ? 'bearish' : 'neutral'

    return [this.detection(context, direction, 72, {
      volumeRatio: ratio, volume: c.volume, avgVolume: avgVol,
    }, ['volume-spike', direction])]
  }

  confidence(detection: RuleDetection): number {
    const ratio = (detection.metadata.volumeRatio as number) ?? 1
    return ConfidenceEngine.calculate(detection, {
      pattern_strength: detection.rawScore,
      volume_confirmation: Math.min(100, ratio * 30),
    })
  }

  explain(detection: RuleDetection): string {
    return `Volume spike ${detection.direction} at ${detection.timestamp} — ${(detection.metadata.volumeRatio as number).toFixed(1)}x average`
  }
}
