import { Star } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ResearchAnalysisNarrative, ResearchRating } from '@/core/research'

const RATING_COPY: Record<ResearchRating, string> = {
  strong: 'Historical metrics look constructive, still require out-of-sample validation.',
  fair: 'Historical metrics are acceptable but not decisive.',
  mixed: 'Historical metrics are mixed — review weaknesses before acting.',
  poor: 'Historical metrics are weak — do not treat as a candidate for live use.',
  inconclusive: 'Sample or constraints leave the result inconclusive.',
}

interface RatingCardProps {
  analysis: ResearchAnalysisNarrative
}

export function RatingCard({ analysis }: RatingCardProps) {
  return (
    <Card hover={false}>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Research Rating</CardTitle>
        </div>
        <Badge
          variant="outline"
          className={cn(
            'capitalize text-[10px]',
            analysis.rating === 'strong' && 'border-success/30 bg-success/10 text-success',
            analysis.rating === 'poor' && 'border-danger/30 bg-danger/10 text-danger',
          )}
        >
          {analysis.rating}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-pretty text-sm text-muted-foreground">
          {RATING_COPY[analysis.rating]}
        </p>
        <p className="text-[11px] text-muted-foreground">
          Not marketed as a “best strategy” — historical research rating only.
        </p>
      </CardContent>
    </Card>
  )
}
