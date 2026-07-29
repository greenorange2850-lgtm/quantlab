import { motion } from 'framer-motion'
import { FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

/**
 * Mobile-first Reports shell (UI only).
 * Cards are single-column; sample table scrolls inside its container only.
 */
export function ReportsPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex min-w-0 w-full flex-col gap-4"
    >
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight">Reports</h2>
        <p className="text-pretty text-xs text-muted-foreground">
          Generate and export institutional-grade performance reports.
        </p>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4">
        <Card className="min-w-0">
          <CardHeader className="flex flex-row items-center gap-3 pb-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/15">
              <FileText className="h-4 w-4 text-accent" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base">Performance Summary</CardTitle>
              <p className="text-pretty text-xs text-muted-foreground">
                Equity, drawdown, and trade quality — coming soon
              </p>
            </div>
            <Badge variant="outline" className="ml-auto shrink-0 text-[10px]">
              Planned
            </Badge>
          </CardHeader>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sample Metrics</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 p-0">
            <div className="min-w-0 overflow-x-auto">
              <table className="w-full min-w-[480px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-4 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Metric
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Value
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Period
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Net Profit', '—', 'All'],
                    ['Max Drawdown', '—', 'All'],
                    ['Win Rate', '—', 'All'],
                    ['Profit Factor', '—', 'All'],
                  ].map(([metric, value, period]) => (
                    <tr key={metric} className="border-b border-border/50">
                      <td className="px-4 py-2.5 text-xs">{metric}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-muted">{value}</td>
                      <td className="px-4 py-2.5 text-xs text-muted">{period}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  )
}
