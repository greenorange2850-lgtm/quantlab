import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Sparkles, Check, X, Play, FlaskConical } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { EmptyState } from '@/components/ui/empty-state'
import { AnimatedCounter } from '@/hooks/use-animated-counter'
import type { AiRecommendationSummary } from '@/types'

interface AiRecommendationPanelProps {
  recommendation: AiRecommendationSummary | null
}

/** True when a real AI research payload is present (not a stub). */
export function hasAiRecommendation(
  recommendation: AiRecommendationSummary | null | undefined,
): recommendation is AiRecommendationSummary {
  if (!recommendation) return false
  return (
    recommendation.suggestions.length > 0 ||
    recommendation.reasoning.trim().length > 0 ||
    recommendation.confidence > 0
  )
}

export function AiRecommendationPanel({ recommendation }: AiRecommendationPanelProps) {
  const hasData = hasAiRecommendation(recommendation)

  if (!hasData) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.45 }}
      >
        <Card className="relative overflow-hidden border-accent/20">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-purple-600/5 pointer-events-none" />
          <CardHeader className="relative">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15">
                <Sparkles className="h-4 w-4 text-accent" />
              </div>
              <div>
                <CardTitle className="text-base">AI Recommendation</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Improvement suggestions based on backtest analysis
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="relative">
            <EmptyState
              icon={<Sparkles className="h-6 w-6" />}
              title="No AI research has been generated."
              description="AI recommendations appear after a Research session analyzes a completed backtest."
              action={
                <Link to="/strategy-lab">
                  <Button size="sm">
                    <FlaskConical className="h-3.5 w-3.5" />
                    Run a Research session
                  </Button>
                </Link>
              }
              className="py-8"
            />
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  const suggestions = recommendation.suggestions.filter((s) => s.type === 'add')
  const avoid = recommendation.suggestions.filter((s) => s.type === 'avoid')

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.45 }}
    >
      <Card className="relative overflow-hidden border-accent/20">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-purple-600/5 pointer-events-none" />
        <CardHeader className="relative">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15">
              <Sparkles className="h-4 w-4 text-accent" />
            </div>
            <div>
              <CardTitle className="text-base">AI Recommendation</CardTitle>
              <p className="text-xs text-muted-foreground">Improvement suggestions based on backtest analysis</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-medium text-success mb-3 flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" />
                Suggested Improvements
              </p>
              <ul className="space-y-2">
                {suggestions.map((s, i) => (
                  <motion.li
                    key={s.id}
                    className="flex items-center gap-2 text-sm text-foreground/90"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.08 }}
                  >
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-success-muted">
                      <Check className="h-3 w-3 text-success" />
                    </div>
                    {s.text}
                  </motion.li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium text-danger mb-3 flex items-center gap-1.5">
                <X className="h-3.5 w-3.5" />
                Avoid
              </p>
              <ul className="space-y-2">
                {avoid.map((s, i) => (
                  <motion.li
                    key={s.id}
                    className="flex items-center gap-2 text-sm text-foreground/90"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.08 }}
                  >
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-danger-muted">
                      <X className="h-3 w-3 text-danger" />
                    </div>
                    {s.text}
                  </motion.li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-white/[0.02] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Confidence Score</span>
              <span className="text-sm font-semibold font-mono text-accent">
                <AnimatedCounter value={recommendation.confidence} suffix="%" />
              </span>
            </div>
            <Progress value={recommendation.confidence} indicatorClassName="from-accent to-purple-500" />
            <p className="text-xs text-muted leading-relaxed">{recommendation.reasoning}</p>
          </div>

          <Button className="w-full sm:w-auto">
            <Play className="h-3.5 w-3.5" />
            Run Analysis
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
}
