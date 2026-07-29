import { Lightbulb } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ResearchAnalysisNarrative } from '@/core/research'

interface SuggestionsCardProps {
  analysis: ResearchAnalysisNarrative
}

export function SuggestionsCard({ analysis }: SuggestionsCardProps) {
  return (
    <Card hover={false}>
      <CardHeader>
        <CardTitle className="text-base">Suggestions</CardTitle>
      </CardHeader>
      <CardContent>
        {analysis.suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No suggestions recorded for this result.</p>
        ) : (
          <ul className="space-y-2">
            {analysis.suggestions.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-foreground/90">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span className="text-pretty">{item}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
