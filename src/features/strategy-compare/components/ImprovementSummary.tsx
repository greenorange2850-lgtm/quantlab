import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ImprovementSummaryProps {
  headline: string
}

export function ImprovementSummary({ headline }: ImprovementSummaryProps) {
  return (
    <Card hover={false}>
      <CardHeader>
        <CardTitle className="text-base">Improvement Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-pretty text-sm leading-relaxed text-foreground/90">{headline}</p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Derived from existing report fields only — not a live recommendation engine.
        </p>
      </CardContent>
    </Card>
  )
}
