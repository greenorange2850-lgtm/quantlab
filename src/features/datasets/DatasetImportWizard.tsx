import { useCallback, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Loader2, Upload } from 'lucide-react'
import {
  buildImportPreview,
  CsvValidationError,
  formatCoverageDate,
  formatFileSize,
  parseCsvFile,
  type CsvImportPreview,
  type DatasetMarketType,
  DATASET_MARKET_TYPE_LABELS,
} from '@/data/datasets'
import { useImportDataset } from '@/api/queries/datasets'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { formatPeriodLabel } from '@/data/research-period'

type ImportStep = 'idle' | 'validating' | 'preview' | 'saving' | 'done'

interface DatasetImportWizardProps {
  onImported?: () => void
}

export function DatasetImportWizard({ onImported }: DatasetImportWizardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const importMutation = useImportDataset()

  const [step, setStep] = useState<ImportStep>('idle')
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<CsvImportPreview | null>(null)
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [marketType, setMarketType] = useState<DatasetMarketType>('other')

  const reset = useCallback(() => {
    setStep('idle')
    setProgress(0)
    setProgressLabel('')
    setError(null)
    setPreview(null)
    setName('')
    setSymbol('')
    setMarketType('other')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return

    const files = [...fileList]
    setError(null)
    setStep('validating')
    setProgress(0)
    setPreview(null)

    try {
      const parsed = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!
        setProgressLabel(`Validating ${file.name} (${i + 1}/${files.length})…`)
        const filePreview = await parseCsvFile(file, {
          onFileProgress: (ratio) => {
            const overall = ((i + ratio) / files.length) * 100
            setProgress(overall)
          },
        })
        parsed.push(filePreview)
      }

      const nextPreview = buildImportPreview(parsed)
      setPreview(nextPreview)
      setName(nextPreview.suggestedName)
      setSymbol(nextPreview.suggestedSymbol)
      setMarketType(nextPreview.suggestedMarketType)
      setProgress(100)
      setProgressLabel('Validation complete')
      setStep('preview')
    } catch (err) {
      const message =
        err instanceof CsvValidationError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to validate CSV files'
      setError(message)
      setStep('idle')
      setProgress(0)
      setProgressLabel('')
    }
  }

  const handleSave = async () => {
    if (!preview) return
    setStep('saving')
    setError(null)
    setProgressLabel('Saving into Dataset Library…')
    try {
      await importMutation.mutateAsync({
        name,
        symbol,
        marketType,
        provider: 'local',
        files: preview.files,
      })
      setStep('done')
      setProgressLabel('Ready for Research')
      onImported?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save dataset')
      setStep('preview')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Import Dataset</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-pretty text-xs text-muted-foreground">
          Select multiple CSV files at once (e.g. XAU_15m_data.csv, XAU_1h_data.csv).
          Timeframes are detected from filenames. Import once — reuse forever.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          multiple
          className="hidden"
          onChange={(event) => void handleFiles(event.target.files)}
        />

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            className="min-h-11 w-full sm:min-h-9 sm:w-auto"
            disabled={step === 'validating' || step === 'saving'}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            Choose CSV files
          </Button>
          {(preview || error) && (
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 w-full sm:min-h-9 sm:w-auto"
              disabled={step === 'validating' || step === 'saving'}
              onClick={reset}
            >
              Reset
            </Button>
          )}
        </div>

        {(step === 'validating' || step === 'saving') && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {progressLabel}
            </div>
            <Progress value={progress} />
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Dataset saved. Ready for Research in Optimizer and Strategy Lab.
            </div>
          </div>
        )}

        {preview && step !== 'done' && (
          <div className="space-y-4 rounded-lg border border-border/60 bg-white/[0.02] p-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Preview
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Validate → Preview → Save into Dataset Library → Ready for Research
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0 space-y-1 text-xs">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Rows
                </p>
                <p className="font-mono text-foreground">
                  {preview.totalRows.toLocaleString()}
                </p>
              </div>
              <div className="min-w-0 space-y-1 text-xs">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Date range
                </p>
                <p className="text-foreground">
                  {formatCoverageDate(preview.startDate)} →{' '}
                  {formatCoverageDate(preview.endDate)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {formatPeriodLabel(preview.startDate, preview.endDate)}
                </p>
              </div>
              <div className="min-w-0 space-y-1 text-xs sm:col-span-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Timeframes
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {preview.timeframes.map((tf) => (
                    <span
                      key={tf}
                      className="rounded border border-border/60 bg-white/[0.03] px-2 py-0.5 font-mono text-[11px] text-foreground"
                    >
                      ✓ {tf}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {preview.files.map((file) => (
                <div
                  key={file.fileName}
                  className="rounded-lg border border-border/50 px-3 py-2 text-xs space-y-2"
                >
                  <div>
                    <p className="font-mono text-foreground">{file.fileName}</p>
                    <p className="mt-1 text-muted-foreground">
                      {file.symbol} · {file.timeframe} · {file.rowCount.toLocaleString()} rows ·{' '}
                      {formatFileSize(file.fileSize)}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Detected delimiter
                      </p>
                      <p className="font-mono text-foreground">
                        {file.delimiterLabel}
                        <span className="text-muted-foreground">
                          {' '}
                          ({file.delimiter === '\t' ? '\\t' : file.delimiter})
                        </span>
                      </p>
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Column mapping
                      </p>
                      <p className="font-mono text-[11px] text-foreground break-words">
                        timestamp←{file.columnMapping.timestamp}
                        {' · '}open←{file.columnMapping.open}
                        {' · '}high←{file.columnMapping.high}
                        {' · '}low←{file.columnMapping.low}
                        {' · '}close←{file.columnMapping.close}
                        {file.columnMapping.volume
                          ? ` · volume←${file.columnMapping.volume}`
                          : ' · volume←(none)'}
                      </p>
                    </div>
                  </div>
                  {file.warnings.length > 0 && (
                    <p className="text-warning">
                      {file.warnings.length} warning
                      {file.warnings.length === 1 ? '' : 's'}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="min-w-0 space-y-2">
                <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Name
                </label>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="bg-white/[0.03]"
                />
              </div>
              <div className="min-w-0 space-y-2">
                <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Symbol
                </label>
                <Input
                  value={symbol}
                  onChange={(event) => setSymbol(event.target.value.toUpperCase())}
                  className="bg-white/[0.03] font-mono"
                />
              </div>
              <div className="min-w-0 space-y-2">
                <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Market
                </label>
                <select
                  value={marketType}
                  onChange={(event) =>
                    setMarketType(event.target.value as DatasetMarketType)
                  }
                  className="flex h-11 w-full rounded-lg border border-border bg-white/[0.03] px-3 text-sm"
                >
                  {(Object.keys(DATASET_MARKET_TYPE_LABELS) as DatasetMarketType[]).map(
                    (key) => (
                      <option key={key} value={key} className="bg-card-solid">
                        {DATASET_MARKET_TYPE_LABELS[key]}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>

            <Button
              type="button"
              className="min-h-11 w-full sm:min-h-9 sm:w-auto"
              disabled={
                step === 'saving' || !name.trim() || !symbol.trim() || importMutation.isPending
              }
              onClick={() => void handleSave()}
            >
              {step === 'saving' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save into Dataset Library'
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
