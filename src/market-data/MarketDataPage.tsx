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
    <motion.div className="min-w-0 space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold">Market Data Engine</h2>
        <p className="text-pretty text-sm text-muted-foreground">
          Import, validate, and manage historical candle data
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-2">
          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Symbol
          </label>
          {symLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {symbols?.map((s) => (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => setSymbol(s.name)}
                  className={cn(
                    'min-h-11 rounded-lg border px-3 py-2 font-mono text-xs font-medium transition-all',
                    symbol === s.name
                      ? 'border-accent bg-accent/10'
                      : 'border-border text-muted hover:bg-white/[0.03]',
                  )}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="min-w-0 space-y-2 lg:shrink-0">
          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Timeframe
          </label>
          {tfLoading ? (
            <Skeleton className="h-10 w-full sm:w-48" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {timeframes?.map((t) => (
                <button
                  key={t.code}
                  type="button"
                  onClick={() => setTimeframe(t.code)}
                  className={cn(
                    'min-h-11 rounded-lg border px-3 py-2 font-mono text-xs font-medium transition-all',
                    timeframe === t.code
                      ? 'border-accent bg-accent/10'
                      : 'border-border text-muted hover:bg-white/[0.03]',
                  )}
                >
                  {t.code}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <DataOverview symbol={symbol} timeframe={timeframe} />
      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        <ImportPanel symbol={symbol} timeframe={timeframe} />
        <CandleChart symbol={symbol} timeframe={timeframe} />
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        <QualityReport symbol={symbol} timeframe={timeframe} />
        <ImportHistory />
      </div>
      <CandleTable symbol={symbol} timeframe={timeframe} />
    </motion.div>
  )
}
