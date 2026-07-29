import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useMdeCandles } from '../hooks/useMarketData'
import { cn } from '@/lib/utils'

interface CandleTableProps {
  symbol: string | null
  timeframe: string | null
}

export function CandleTable({ symbol, timeframe }: CandleTableProps) {
  const { data, isLoading } = useMdeCandles(symbol, timeframe, 50)
  if (!symbol || !timeframe || isLoading) return isLoading ? <Skeleton className="h-48 rounded-xl" /> : null
  if (!data?.length) return null

  const rows = [...data].reverse()

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Candle Data</CardTitle></CardHeader>
      <CardContent className="min-w-0 p-0">
        <div className="max-h-[300px] min-w-0 overflow-auto">
          <table className="w-full min-w-[560px] text-xs">
            <thead className="sticky top-0 bg-card-solid/95">
              <tr className="border-b border-border">
                {['Timestamp', 'O', 'H', 'L', 'C', 'Vol', 'Session'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] text-muted-foreground uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const bull = Number(c.close) >= Number(c.open)
                return (
                  <tr key={String(c.id)} className="border-b border-border/40 hover:bg-white/[0.02]">
                    <td className="px-3 py-1.5 font-mono text-muted">{String(c.timestamp).replace('T', ' ').slice(0, 19)}</td>
                    <td className="px-3 py-1.5 font-mono">{Number(c.open)}</td>
                    <td className="px-3 py-1.5 font-mono text-success">{Number(c.high)}</td>
                    <td className="px-3 py-1.5 font-mono text-danger">{Number(c.low)}</td>
                    <td className={cn('px-3 py-1.5 font-mono font-medium', bull ? 'text-success' : 'text-danger')}>{Number(c.close)}</td>
                    <td className="px-3 py-1.5 font-mono text-muted">{Number(c.volume)}</td>
                    <td className="px-3 py-1.5"><Badge variant="outline" className="text-[9px] capitalize">{String(c.session ?? '—')}</Badge></td>
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
