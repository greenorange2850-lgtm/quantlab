import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { AnimatedCounter } from '@/hooks/use-animated-counter'
import type { HealthMetric } from '@/types'

interface StrategyHealthProps {
  metrics: HealthMetric[]
  overallScore: number
}

function CircularGauge({ score, size = 140 }: { score: number; size?: number }) {
  const radius = (size - 16) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  const getColor = (s: number) => {
    if (s >= 80) return '#22c55e'
    if (s >= 60) return '#6366f1'
    if (s >= 40) return '#f59e0b'
    return '#ef4444'
  }

  return (
    <div className="relative" style={{ width: size, height: size }}>
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
          stroke={getColor(score)}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 8px ${getColor(score)}40)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold font-mono tracking-tight">
          <AnimatedCounter value={score} />
        </span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
          Overall
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
        </CardHeader>
        <CardContent className="min-w-0">
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <CircularGauge score={overallScore} />
            <div className="w-full min-w-0 flex-1 space-y-3">
              {metrics.map((metric, i) => (
                <motion.div
                  key={metric.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + i * 0.06 }}
                  className="min-w-0 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="min-w-0 truncate text-muted">{metric.label}</span>
                    <span className="shrink-0 font-mono font-medium">
                      <AnimatedCounter value={metric.score} suffix="/100" />
                    </span>
                  </div>
                  <Progress value={metric.score} />
                </motion.div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
