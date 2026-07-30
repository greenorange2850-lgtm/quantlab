import { cn } from '@/lib/utils'
import {
  RESEARCH_SCORE_BASIS,
  qualityTextClass,
  researchScoreQuality,
} from '@/lib/metric-semantics'

interface ResearchScoreProps {
  score: number
  /** Compact inline (cards) vs stacked (health panel). */
  size?: 'sm' | 'md' | 'lg'
  className?: string
  /** Hide the basis line (e.g. when shown elsewhere). */
  showBasis?: boolean
}

/**
 * Displays an existing 0–100 research/health score with hierarchy and basis copy.
 * Does not recalculate — pass the score already computed by the view model.
 */
export function ResearchScore({
  score,
  size = 'md',
  className,
  showBasis = true,
}: ResearchScoreProps) {
  const quality = researchScoreQuality(score)
  const display = Number.isFinite(score) ? Math.round(score) : 0

  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Research Score
      </p>
      <p
        className={cn(
          'mt-1 font-mono font-semibold tabular-nums tracking-tight',
          size === 'lg' && 'text-3xl',
          size === 'md' && 'text-xl',
          size === 'sm' && 'text-base',
          qualityTextClass(quality),
        )}
      >
        {display} / 100
      </p>
      {showBasis ? (
        <p className="mt-1.5 max-w-[16rem] text-[10px] leading-relaxed text-muted-foreground">
          {RESEARCH_SCORE_BASIS}
        </p>
      ) : null}
    </div>
  )
}
