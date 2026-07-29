import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ResearchAnalysisNarrative } from '@/core/research'

interface SummaryCardProps {
  analysis: ResearchAnalysisNarrative
}

export function SummaryCard({ analysis }: SummaryCardProps) {
  return (
    <Card hover={false}>
      <CardHeader>
        <CardTitle className="text-base">Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-pretty text-sm leading-relaxed text-foreground/90">
          {analysis.summary}
        </p>
      </CardContent>
    </Card>
  )
}
