import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { StrategyViewModel } from '@/strategies'

interface VersionsTabProps {
  strategy: StrategyViewModel
}

function formatParams(params: {
  fastPeriod: number
  slowPeriod: number
  rsiPeriod: number
}): string {
  return `${params.fastPeriod} / ${params.slowPeriod} / ${params.rsiPeriod}`
}

export function VersionsTab({ strategy }: VersionsTabProps) {
  if (strategy.versions.length === 0) {
    return (
      <Card hover={false} className="border-dashed">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Version history will appear after Random Search produces a baseline or improvements.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {strategy.versions.map((version) => (
        <Card key={version.id} hover={false}>
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base">
                v{version.versionNumber} · {version.label}
              </CardTitle>
              <p className="font-mono text-xs text-muted-foreground">
                {formatParams(version.parameters)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {version.isBaseline ? (
                <Badge variant="outline" className="text-[10px]">
                  Baseline
                </Badge>
              ) : null}
              {version.isCurrent ? (
                <Badge variant="accent" className="text-[10px]">
                  Current
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-1 text-xs text-muted-foreground">
            <p>{version.changelog}</p>
            {version.score !== null ? (
              <p className="font-mono">Score: {version.score.toFixed(2)}</p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
