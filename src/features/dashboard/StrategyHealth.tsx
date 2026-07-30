import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Disclosure } from '@/components/ui/disclosure'
import { Progress } from '@/components/ui/progress'
import { ResearchScore } from '@/components/ui/research-score'
import { AnimatedCounter } from '@/hooks/use-animated-counter'
import {
  RESEARCH_SCORE_BASIS,
  qualityStrokeColor,
  researchScoreQuality,
} from '@/lib/metric-semantics'
import type { HealthMetric } from '@/types'

interface StrategyHealthProps {
  metrics: HealthMetric[]
  overallScore: number
}

function CircularGauge({ score, size = 132 }: { score: number; size?: number }) {
  const radius = (size - 16) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const stroke = qualityStrokeColor(researchScoreQuality(score))

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={8}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Research Score
        </span>
        <span className="mt-0.5 font-mono text-3xl font-bold tracking-tight">
          <AnimatedCounter value={score} />
          <span className="text-sm font-medium text-muted-foreground"> / 100</span>
        </span>
      </div>
    </div>
  )
}

export function StrategyHealth({ metrics, overallScore }: StrategyHealthProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Strategy Health</CardTitle>
          <p className="text-xs text-muted-foreground">{RESEARCH_SCORE_BASIS}</p>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4">
          <CircularGauge score={overallScore} />
          <div className="sr-only">
            <ResearchScore score={overallScore} />
          </div>
          <Disclosure title="Health breakdown" variant="plain">
            <div className="space-y-3.5">
              {metrics.map((metric) => (
                <div key={metric.id} className="min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate text-muted">{metric.label}</span>
                    <span className="shrink-0 font-mono font-medium tabular-nums">
                      <AnimatedCounter value={metric.score} suffix="/100" />
                    </span>
                  </div>
                  <Progress value={metric.score} />
                </div>
              ))}
            </div>
          </Disclosure>
        </CardContent>
      </Card>
    </motion.div>
  )
}
