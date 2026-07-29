import { CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ResearchAnalysisNarrative } from '@/core/research'

interface StrengthsCardProps {
  analysis: ResearchAnalysisNarrative
}

export function StrengthsCard({ analysis }: StrengthsCardProps) {
  return (
    <Card hover={false}>
      <CardHeader>
        <CardTitle className="text-base">Strengths</CardTitle>
      </CardHeader>
      <CardContent>
        {analysis.strengths.length === 0 ? (
          <p className="text-sm text-muted-foreground">No strengths recorded for this result.</p>
        ) : (
          <ul className="space-y-2">
            {analysis.strengths.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-foreground/90">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span className="text-pretty">{item}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
