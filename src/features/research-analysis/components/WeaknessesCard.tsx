import { AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ResearchAnalysisNarrative } from '@/core/research'

interface WeaknessesCardProps {
  analysis: ResearchAnalysisNarrative
}

export function WeaknessesCard({ analysis }: WeaknessesCardProps) {
  return (
    <Card hover={false}>
      <CardHeader>
        <CardTitle className="text-base">Weaknesses</CardTitle>
      </CardHeader>
      <CardContent>
        {analysis.weaknesses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No weaknesses recorded for this result.</p>
        ) : (
          <ul className="space-y-2">
            {analysis.weaknesses.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-foreground/90">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                <span className="text-pretty">{item}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
