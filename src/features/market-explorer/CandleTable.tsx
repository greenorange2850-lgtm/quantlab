import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useCandles } from '@/api/queries/market-data'
import { cn } from '@/lib/utils'

interface CandleTableProps {
  symbolId: string | null
  timeframeId: string | null
}

export function CandleTable({ symbolId, timeframeId }: CandleTableProps) {
  const { data: candles, isLoading } = useCandles(symbolId, timeframeId, 50)

  if (!symbolId || !timeframeId) return null

  if (isLoading) return <Skeleton className="h-64 rounded-xl" />

  if (!candles?.length) return null

  const reversed = [...candles].reverse()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Recent Candles</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-card-solid/95 backdrop-blur-sm">
              <tr className="border-b border-border">
                {['Timestamp', 'Open', 'High', 'Low', 'Close', 'Volume'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reversed.map((c) => {
                const bullish = c.close >= c.open
                return (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-white/[0.02]">
                    <td className="px-4 py-2 text-xs font-mono text-muted">
                      {c.timestamp.replace('T', ' ').slice(0, 19)}
                    </td>
                    <td className="px-4 py-2 text-xs font-mono">{c.open}</td>
                    <td className="px-4 py-2 text-xs font-mono text-success">{c.high}</td>
                    <td className="px-4 py-2 text-xs font-mono text-danger">{c.low}</td>
                    <td className={cn('px-4 py-2 text-xs font-mono font-medium', bullish ? 'text-success' : 'text-danger')}>
                      {c.close}
                    </td>
                    <td className="px-4 py-2 text-xs font-mono text-muted">{c.volume}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
