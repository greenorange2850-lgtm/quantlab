import { ShieldAlert } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ResearchAnalysisNarrative, ResearchRiskLevel } from '@/core/research'

const RISK_COPY: Record<ResearchRiskLevel, string> = {
  low: 'Drawdown profile is contained relative to common research thresholds.',
  moderate: 'Drawdown is noticeable — treat as a historical risk signal.',
  elevated: 'Drawdown is elevated — additional validation is warranted.',
  high: 'Drawdown is high — do not treat this result as deployment-ready.',
}

const RISK_BADGE: Record<ResearchRiskLevel, string> = {
  low: 'border-success/30 bg-success/10 text-success',
  moderate: 'border-border bg-white/5 text-foreground',
  elevated: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  high: 'border-danger/30 bg-danger/10 text-danger',
}

interface RiskCardProps {
  analysis: ResearchAnalysisNarrative
}

export function RiskCard({ analysis }: RiskCardProps) {
  return (
    <Card hover={false}>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Risk Level</CardTitle>
        </div>
        <Badge
          variant="outline"
          className={cn('capitalize text-[10px]', RISK_BADGE[analysis.riskLevel])}
        >
          {analysis.riskLevel}
        </Badge>
      </CardHeader>
      <CardContent>
        <p className="text-pretty text-sm text-muted-foreground">
          {RISK_COPY[analysis.riskLevel]} Derived from archived max drawdown — not a live risk engine.
        </p>
      </CardContent>
    </Card>
  )
}
