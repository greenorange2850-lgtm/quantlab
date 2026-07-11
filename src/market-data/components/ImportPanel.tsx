import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import type { MarketDataSource } from '../types/index.js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { useMdeImport } from '../hooks/useMarketData'

const SOURCES: { id: MarketDataSource; label: string; desc: string }[] = [
  { id: 'csv', label: 'CSV', desc: 'Standard OHLCV format' },
  { id: 'metatrader', label: 'MetaTrader', desc: 'MT4/MT5 export' },
  { id: 'dukascopy', label: 'Dukascopy', desc: 'Dukascopy CSV data' },
]

interface ImportPanelProps {
  symbol: string | null
  timeframe: string | null
}

export function ImportPanel({ symbol, timeframe }: ImportPanelProps) {
  const [source, setSource] = useState<MarketDataSource>('csv')
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const importMut = useMdeImport()

  const canImport = !!symbol && !!timeframe && !!file

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) { setFile(f); importMut.reset() }
  }, [importMut])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Upload className="h-4 w-4 text-accent" /> Import Engine
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              onClick={() => setSource(s.id)}
              className={cn(
                'rounded-lg border p-3 text-left transition-all',
                source === s.id ? 'border-accent/40 bg-accent/10' : 'border-border hover:bg-white/[0.03]',
              )}
            >
              <p className="text-xs font-medium">{s.label}</p>
              <p className="text-[10px] text-muted-foreground">{s.desc}</p>
            </button>
          ))}
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => document.getElementById('mde-file')?.click()}
          className={cn(
            'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 cursor-pointer transition-all',
            dragOver ? 'border-accent bg-accent/5' : 'border-border hover:border-border-hover',
          )}
        >
          <input id="mde-file" type="file" className="hidden" accept=".csv,.txt,.tsv" onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])} />
          <FileSpreadsheet className="h-8 w-8 text-muted mb-2" />
          {file ? (
            <p className="text-sm font-medium">{file.name} <span className="text-muted-foreground">({(file.size / 1024).toFixed(1)} KB)</span></p>
          ) : (
            <p className="text-sm text-muted-foreground">Drag & drop or click to browse</p>
          )}
        </div>

        {importMut.isPending && (
          <div className="space-y-2">
            <Progress value={66} className="h-1" />
            <p className="text-xs text-muted text-center">Processing and validating...</p>
          </div>
        )}

        <Button className="w-full" disabled={!canImport || importMut.isPending} onClick={() => file && symbol && timeframe && importMut.mutate({ file, source, symbol, timeframe })}>
          {importMut.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Importing...</> : <><Upload className="h-4 w-4" /> Import Data</>}
        </Button>

        <AnimatePresence>
          {importMut.isSuccess && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-lg border border-success/20 bg-success-muted p-4 space-y-2">
              <div className="flex items-center gap-2 text-success text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" /> Import Complete
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-muted-foreground">Imported</span><p className="font-mono font-medium">{importMut.data.job.rowsImported}</p></div>
                <div><span className="text-muted-foreground">Rejected</span><p className="font-mono font-medium">{importMut.data.job.rowsRejected}</p></div>
                <div><span className="text-muted-foreground">Quality</span><p className="font-mono font-medium text-accent">{importMut.data.quality.qualityScore}%</p></div>
                <div><span className="text-muted-foreground">Duration</span><p className="font-mono font-medium">{importMut.data.job.durationMs}ms</p></div>
              </div>
            </motion.div>
          )}
          {importMut.isError && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg border border-danger/20 bg-danger-muted p-3 flex gap-2">
              <AlertCircle className="h-4 w-4 text-danger shrink-0" />
              <p className="text-xs text-danger">{importMut.error.message}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}
