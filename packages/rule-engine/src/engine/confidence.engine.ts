import type { RuleDetection, MarketEvent } from '../types/index.js'

export class ConfidenceEngine {
  static calculate(detection: RuleDetection, factors: Record<string, number>): number {
    let weighted = 0
    let totalWeight = 0

    for (const [metric, value] of Object.entries(factors)) {
      const weight = WEIGHTS[metric] ?? 1
      weighted += Math.min(100, Math.max(0, value)) * weight
      totalWeight += weight
    }

    const base = totalWeight > 0 ? weighted / totalWeight : detection.rawScore
    return Math.min(100, Math.round(base * 10) / 10)
  }

  static breakdown(detection: RuleDetection, factors: Record<string, number>): Array<{ metric: string; value: number; weight: number }> {
    return Object.entries(factors).map(([metric, value]) => ({
      metric,
      value: Math.min(100, Math.max(0, value)),
      weight: WEIGHTS[metric] ?? 1,
    }))
  }
}

const WEIGHTS: Record<string, number> = {
  pattern_strength: 1.5,
  volume_confirmation: 1.0,
  htf_alignment: 1.2,
  session_quality: 0.8,
  structure_context: 1.0,
  wick_ratio: 0.7,
  gap_size: 0.9,
  liquidity_proximity: 1.1,
}

export function applyConfidence(event: MarketEvent, breakdown: Array<{ metric: string; value: number; weight: number }>): MarketEvent {
  const total = breakdown.reduce((s, b) => s + b.value * b.weight, 0)
  const weightSum = breakdown.reduce((s, b) => s + b.weight, 0)
  const confidence = weightSum > 0 ? Math.min(100, Math.round((total / weightSum) * 10) / 10) : event.confidence
  return { ...event, confidence, scores: breakdown }
}
