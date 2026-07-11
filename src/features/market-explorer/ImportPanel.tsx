import { useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import type { ImportSource } from '@trading-os/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useImportMarketData } from '@/api/queries/market-data'

const SOURCES: { id: ImportSource; label: string; description: string }[] = [
  { id: 'csv', label: 'CSV', description: 'Standard OHLCV comma/tab separated' },
  { id: 'metatrader', label: 'MetaTrader', description: 'MT4/MT5 history export' },
  { id: 'dukascopy', label: 'Dukascopy', description: 'Dukascopy tick/candle CSV' },
  { id: 'sqlite', label: 'SQLite', description: 'Import from SQLite database file' },
]

interface ImportPanelProps {
  symbolId: string | null
  timeframeId: string | null
}

export function ImportPanel({ symbolId, timeframeId }: ImportPanelProps) {
  const [source, setSource] = useState<ImportSource>('csv')
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const importMutation = useImportMarketData()

  const canImport = !!symbolId && !!timeframeId && !!selectedFile

  const handleFile = useCallback((file: File) => {
    setSelectedFile(file)
    importMutation.reset()
  }, [importMutation])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const handleImport = () => {
    if (!canImport || !selectedFile || !symbolId || !timeframeId) return
    importMutation.mutate({ file: selectedFile, source, symbolId, timeframeId })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-accent" />
          Import Market Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              onClick={() => setSource(s.id)}
              className={cn(
                'rounded-lg border p-3 text-left transition-all',
                source === s.id
                  ? 'border-accent/40 bg-accent/10'
                  : 'border-border hover:border-border-hover hover:bg-white/[0.03]',
              )}
            >
              <p className="text-xs font-medium">{s.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{s.description}</p>
            </button>
          ))}
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            'relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all cursor-pointer',
            dragOver ? 'border-accent bg-accent/5' : 'border-border hover:border-border-hover',
          )}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <input
            id="file-input"
            type="file"
            className="hidden"
            accept=".csv,.txt,.sqlite,.db,.tsv"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <FileSpreadsheet className="h-8 w-8 text-muted mb-3" />
          {selectedFile ? (
            <>
              <p className="text-sm font-medium">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">Drop file here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">CSV, MT export, SQLite, Dukascopy</p>
            </>
          )}
        </div>

        {!symbolId || !timeframeId ? (
          <p className="text-xs text-warning text-center">Select a symbol and timeframe first</p>
        ) : null}

        <Button
          className="w-full"
          disabled={!canImport || importMutation.isPending}
          onClick={handleImport}
        >
          {importMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Import {source.toUpperCase()} Data
            </>
          )}
        </Button>

        <AnimatePresence>
          {importMutation.isSuccess && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-lg border border-success/20 bg-success-muted p-4 space-y-2"
            >
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-sm font-medium">Import successful</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Imported</span>
                  <p className="font-mono font-medium">{importMutation.data.imported.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Skipped</span>
                  <p className="font-mono font-medium">{importMutation.data.skipped}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Date range</span>
                  <p className="font-mono text-[11px]">
                    {importMutation.data.dateRange.start?.split('T')[0]} → {importMutation.data.dateRange.end?.split('T')[0]}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px]">{importMutation.data.format}</Badge>
            </motion.div>
          )}

          {importMutation.isError && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-danger/20 bg-danger-muted p-4 flex items-start gap-2"
            >
              <AlertCircle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
              <p className="text-xs text-danger">{importMutation.error.message}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  )
}
