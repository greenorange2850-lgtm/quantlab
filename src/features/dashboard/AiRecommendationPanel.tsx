import { motion } from 'framer-motion'
import { Sparkles, Check, X, Play } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Disclosure } from '@/components/ui/disclosure'
import { Progress } from '@/components/ui/progress'
import { AnimatedCounter } from '@/hooks/use-animated-counter'
import type { AiRecommendationSummary } from '@/types'

interface AiRecommendationPanelProps {
  recommendation: AiRecommendationSummary
}

export function AiRecommendationPanel({ recommendation }: AiRecommendationPanelProps) {
  const suggestions = recommendation.suggestions.filter((s) => s.type === 'add').slice(0, 2)
  const avoid = recommendation.suggestions.filter((s) => s.type === 'avoid')

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.45 }}
    >
      <Card className="relative overflow-hidden border-accent/20">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-transparent" />
        <CardHeader className="relative">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15">
              <Sparkles className="h-4 w-4 text-accent" />
            </div>
            <div>
              <CardTitle className="text-base">AI Recommendation</CardTitle>
              <p className="text-xs text-muted-foreground">
                Confidence{' '}
                <span className="font-mono text-accent">
                  <AnimatedCounter value={recommendation.confidence} suffix="%" />
                </span>
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative space-y-4">
          <Progress value={recommendation.confidence} indicatorClassName="from-accent to-accent/70" />

          <ul className="space-y-2">
            {suggestions.map((s, i) => (
              <motion.li
                key={s.id}
                className="flex items-start gap-2 text-sm text-foreground/90"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.08 }}
              >
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-muted">
                  <Check className="h-3 w-3 text-success" />
                </div>
                <span className="min-w-0 text-pretty">{s.text}</span>
              </motion.li>
            ))}
          </ul>

          <Disclosure title="Avoid & reasoning" variant="plain">
            <div className="space-y-3">
              <ul className="space-y-2">
                {avoid.map((s) => (
                  <li key={s.id} className="flex items-start gap-2 text-sm text-foreground/90">
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-danger-muted">
                      <X className="h-3 w-3 text-danger" />
                    </div>
                    <span className="min-w-0 text-pretty">{s.text}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs leading-relaxed text-muted">{recommendation.reasoning}</p>
            </div>
          </Disclosure>

          <Button className="min-h-11 w-full sm:min-h-9 sm:w-auto">
            <Play className="h-3.5 w-3.5" />
            Run Analysis
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  )
}
