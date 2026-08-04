import type { ReactNode } from 'react'
import type { SmcDetectedEventProbe, SmcEventMatch, SmcGoldenLabel } from '@/core/smc'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface SmcGoldenChartCompareProps {
  detected: SmcDetectedEventProbe[]
  expected: SmcGoldenLabel[]
  matched: SmcEventMatch[]
  missed: SmcGoldenLabel[]
  extra: SmcDetectedEventProbe[]
}

function Row({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: ReactNode
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <p className="font-medium">{title}</p>
        <Badge variant="outline" className="text-[10px]">
          {count}
        </Badge>
      </div>
      <ul className="max-h-36 space-y-0.5 overflow-y-auto font-mono text-[10px] text-muted-foreground">
        {children}
      </ul>
    </div>
  )
}

export function SmcGoldenChartCompare({
  detected,
  expected,
  matched,
  missed,
  extra,
}: SmcGoldenChartCompareProps) {
  return (
    <Card hover={false}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Golden chart comparison</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
        <Row title="Detector output" count={detected.length}>
          {detected.length === 0 ? (
            <li>None</li>
          ) : (
            detected.slice(0, 40).map((d) => (
              <li key={d.id}>
                {d.kind} @ {d.candleIndex} · {d.price}
              </li>
            ))
          )}
        </Row>
        <Row title="Manual expected" count={expected.length}>
          {expected.length === 0 ? (
            <li>None</li>
          ) : (
            expected.slice(0, 40).map((e) => (
              <li key={e.id}>
                {e.kind} @ {e.candleIndex} · {e.price}
              </li>
            ))
          )}
        </Row>
        <Row title="Matched events" count={matched.length}>
          {matched.length === 0 ? (
            <li>None</li>
          ) : (
            matched.slice(0, 40).map((m) => (
              <li key={`${m.expectedId}-${m.detectedId}`}>
                {m.kind} · score {m.score.toFixed(3)} · {m.expectedId} ↔ {m.detectedId}
              </li>
            ))
          )}
        </Row>
        <Row title="Missed events (FN)" count={missed.length}>
          {missed.length === 0 ? (
            <li>None</li>
          ) : (
            missed.slice(0, 40).map((e) => (
              <li key={e.id} className="text-amber-200">
                {e.kind} @ {e.candleIndex} · {e.id}
              </li>
            ))
          )}
        </Row>
        <Row title="Extra events (FP)" count={extra.length}>
          {extra.length === 0 ? (
            <li>None</li>
          ) : (
            extra.slice(0, 40).map((d) => (
              <li key={d.id} className="text-danger">
                {d.kind} @ {d.candleIndex} · {d.id}
              </li>
            ))
          )}
        </Row>
      </CardContent>
    </Card>
  )
}
