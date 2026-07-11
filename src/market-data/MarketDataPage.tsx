import { useState } from 'react'
import { motion } from 'framer-motion'
import { ImportPanel } from './components/ImportPanel'
import { DataOverview } from './components/DataOverview'
import { CandleChart } from './components/CandleChart'
import { CandleTable } from './components/CandleTable'
import { QualityReport } from './components/QualityReport'
import { ImportHistory } from './components/ImportHistory'
import { useMdeSymbols, useMdeTimeframes } from './hooks/useMarketData'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

export function MarketDataPage() {
  const [symbol, setSymbol] = useState<string | null>(null)
  const [timeframe, setTimeframe] = useState<string | null>(null)

  const { data: symbols, isLoading: symLoading } = useMdeSymbols()
  const { data: timeframes, isLoading: tfLoading } = useMdeTimeframes()

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div>
        <h2 className="text-lg font-semibold">Market Data Engine</h2>
        <p className="text-sm text-muted-foreground">Import, validate, and manage historical candle data</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-2">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Symbol</label>
          {symLoading ? <Skeleton className="h-10" /> : (
            <div className="flex flex-wrap gap-2">
              {symbols?.map((s) => (
                <button key={s.name} onClick={() => setSymbol(s.name)} className={cn(
                  'rounded-lg border px-3 py-2 text-xs font-mono font-medium transition-all',
                  symbol === s.name ? 'border-accent bg-accent/10' : 'border-border hover:bg-white/[0.03] text-muted',
                )}>{s.name}</button>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Timeframe</label>
          {tfLoading ? <Skeleton className="h-10 w-48" /> : (
            <div className="flex flex-wrap gap-2">
              {timeframes?.map((t) => (
                <button key={t.code} onClick={() => setTimeframe(t.code)} className={cn(
                  'rounded-lg border px-3 py-2 text-xs font-mono font-medium transition-all',
                  timeframe === t.code ? 'border-accent bg-accent/10' : 'border-border hover:bg-white/[0.03] text-muted',
                )}>{t.code}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      <DataOverview symbol={symbol} timeframe={timeframe} />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ImportPanel symbol={symbol} timeframe={timeframe} />
        <CandleChart symbol={symbol} timeframe={timeframe} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <QualityReport symbol={symbol} timeframe={timeframe} />
        <ImportHistory />
      </div>
      <CandleTable symbol={symbol} timeframe={timeframe} />
    </motion.div>
  )
}
