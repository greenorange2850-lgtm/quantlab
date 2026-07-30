/** Presentation-only metric quality — does not recalculate analytics. */

export type MetricQuality = 'excellent' | 'average' | 'poor' | 'neutral'

export type MetricTone = 'default' | 'positive' | 'negative' | 'warning' | 'muted'

/** Map quality → subtle MetricTile tone. */
export function qualityToTone(quality: MetricQuality): MetricTone {
  switch (quality) {
    case 'excellent':
      return 'positive'
    case 'average':
      return 'warning'
    case 'poor':
      return 'negative'
    default:
      return 'default'
  }
}

/** Profit factor: ≥1.5 excellent, ≥1 average, else poor. */
export function profitFactorQuality(value: number): MetricQuality {
  if (!Number.isFinite(value)) return 'neutral'
  if (value >= 1.5) return 'excellent'
  if (value >= 1) return 'average'
  return 'poor'
}

/**
 * Max drawdown quality.
 * Accepts fraction (0–1) or percent magnitude (e.g. 12 or -12).
 */
export function drawdownQuality(value: number): MetricQuality {
  if (!Number.isFinite(value)) return 'neutral'
  const magnitude = Math.abs(value)
  const pct = magnitude <= 1 ? magnitude * 100 : magnitude
  if (pct <= 10) return 'excellent'
  if (pct <= 20) return 'average'
  return 'poor'
}

/** Expectancy: >0 excellent, 0 average, <0 poor. */
export function expectancyQuality(value: number): MetricQuality {
  if (!Number.isFinite(value)) return 'neutral'
  if (value > 0) return 'excellent'
  if (value === 0) return 'average'
  return 'poor'
}

/** Recovery factor: ≥2 excellent, ≥1 average, else poor. */
export function recoveryFactorQuality(value: number): MetricQuality {
  if (!Number.isFinite(value)) return 'neutral'
  if (value >= 2) return 'excellent'
  if (value >= 1) return 'average'
  return 'poor'
}

/** Research score 0–100: ≥70 excellent, ≥40 average, else poor. */
export function researchScoreQuality(score: number): MetricQuality {
  if (!Number.isFinite(score)) return 'neutral'
  if (score >= 70) return 'excellent'
  if (score >= 40) return 'average'
  return 'poor'
}

/** CSS stroke / text color tokens for gauges (subtle, theme-aligned). */
export function qualityStrokeColor(quality: MetricQuality): string {
  switch (quality) {
    case 'excellent':
      return 'var(--color-success)'
    case 'average':
      return 'var(--color-warning)'
    case 'poor':
      return 'var(--color-danger)'
    default:
      return 'var(--color-muted)'
  }
}

export function qualityTextClass(quality: MetricQuality): string {
  switch (quality) {
    case 'excellent':
      return 'text-success'
    case 'average':
      return 'text-warning'
    case 'poor':
      return 'text-danger'
    default:
      return 'text-foreground'
  }
}

export const RESEARCH_SCORE_BASIS =
  'Based on Profit Factor, Drawdown, Win Rate and Consistency.'
