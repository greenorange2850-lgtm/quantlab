import { useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, Database } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import {
  BUILTIN_PLAYBOOKS,
  collectDiagnostics,
  evaluateHistoricalPlaybook,
  type HistoricalEvaluationSuccess,
  type PlaybookDiagnostics,
  type PlaybookPipelineResult,
} from '@/core/playbook'
import { demoPipelineResult } from '@/core/playbook/demo'
import { usePlaybookStore, isDraftDirty } from '@/stores/playbook.store'
import { ConfigurePanel } from './components/ConfigurePanel'
import { DataSourceBar } from './components/DataSourceBar'
import { DecisionCard } from './components/DecisionCard'
import { DiagnosticsPanel } from './components/DiagnosticsPanel'
import { HistorySummary } from './components/HistorySummary'
import { OpenPlaybookReplayButton } from './components/OpenPlaybookReplayButton'
import { PlaybookSelector } from './components/PlaybookSelector'
import {
  usePlaybookHistoricalCatalog,
  usePlaybookHistoricalSeries,
} from './use-playbook-historical'

export function PlaybookLabPage() {
  const selectedPlaybookId = usePlaybookStore((s) => s.selectedPlaybookId)
  const drafts = usePlaybookStore((s) => s.drafts)
  const applied = usePlaybookStore((s) => s.applied)
  const dataSourceKind = usePlaybookStore((s) => s.dataSourceKind)
  const selectedHistoricalKind = usePlaybookStore((s) => s.selectedHistoricalKind)
  const selectedHistoricalId = usePlaybookStore((s) => s.selectedHistoricalId)
  const selectedHistoricalTimeframe = usePlaybookStore((s) => s.selectedHistoricalTimeframe)
  const selectPlaybook = usePlaybookStore((s) => s.selectPlaybook)
  const setDraft = usePlaybookStore((s) => s.setDraft)
  const updateParameter = usePlaybookStore((s) => s.updateParameter)
  const resetDraft = usePlaybookStore((s) => s.resetDraft)
  const applyDraft = usePlaybookStore((s) => s.applyDraft)
  const setDataSourceKind = usePlaybookStore((s) => s.setDataSourceKind)
  const selectHistoricalSource = usePlaybookStore((s) => s.selectHistoricalSource)
  const setHistoricalTimeframe = usePlaybookStore((s) => s.setHistoricalTimeframe)

  const definition = useMemo(
    () => BUILTIN_PLAYBOOKS.find((d) => d.id === selectedPlaybookId) ?? BUILTIN_PLAYBOOKS[0],
    [selectedPlaybookId],
  )

  useEffect(() => {
    if (!drafts[definition.id]) setDraft(definition.id, {})
  }, [definition.id, drafts, setDraft])

  const dirtyIds = useMemo(
    () =>
      BUILTIN_PLAYBOOKS.filter((d) => isDraftDirty({ drafts, applied }, d.id)).map((d) => d.id),
    [drafts, applied],
  )

  const appliedParams = applied[definition.id] ?? drafts[definition.id] ?? {}
  const dirty = isDraftDirty({ drafts, applied }, definition.id)

  const catalogState = usePlaybookHistoricalCatalog()
  const historicalSeries = usePlaybookHistoricalSeries()

  const demoResult = useMemo(() => {
    if (dataSourceKind !== 'demo') return null
    try {
      return demoPipelineResult(definition.id, appliedParams)
    } catch {
      return null
    }
  }, [dataSourceKind, definition.id, applied, drafts])

  const historicalOutcome = useMemo(() => {
    if (dataSourceKind !== 'historical') return null
    if (historicalSeries.loading) return null
    const loaded = historicalSeries.result
    if (!loaded || !loaded.ok) return null
    return evaluateHistoricalPlaybook({
      playbookId: definition.id,
      parameters: appliedParams,
      symbol: loaded.symbol,
      timeframe: loaded.timeframe,
      candles: loaded.candles,
      detectorEvents: loaded.detectorEvents,
    })
  }, [
    dataSourceKind,
    historicalSeries.loading,
    historicalSeries.result,
    definition.id,
    applied,
    drafts,
  ])

  const view = resolveView({
    dataSourceKind,
    catalogLoading: catalogState.loading,
    catalogEmpty: !catalogState.loading && catalogState.catalog.length === 0,
    catalogError: catalogState.error,
    selectedId: selectedHistoricalId,
    seriesLoading: historicalSeries.loading,
    seriesResult: historicalSeries.result,
    demoResult,
    historicalOutcome,
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Playbook Lab</h1>
        <p className="text-xs text-muted-foreground">
          Trader-first decisions derived from detector outputs — read-only, deterministic and
          replayable.
        </p>
      </div>

      <DataSourceBar
        kind={dataSourceKind}
        catalog={catalogState.catalog}
        catalogLoading={catalogState.loading}
        selectedId={selectedHistoricalId}
        selectedKind={selectedHistoricalKind}
        selectedTimeframe={selectedHistoricalTimeframe}
        onKindChange={setDataSourceKind}
        onSelectSource={selectHistoricalSource}
        onTimeframeChange={setHistoricalTimeframe}
      />

      <PlaybookSelector
        definitions={BUILTIN_PLAYBOOKS}
        selectedId={definition.id}
        onSelect={selectPlaybook}
        dirtyIds={dirtyIds}
      />

      {view.type === 'ready' ? (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <HistorySummary
              sourceKind={dataSourceKind}
              evaluation={view.result.evaluation}
              history={view.result.history}
              meta={view.historical?.meta}
              eventSupport={view.historical?.eventSupport}
              action={
                dataSourceKind === 'historical' &&
                historicalSeries.result?.ok ? (
                  <OpenPlaybookReplayButton
                    kind={historicalSeries.result.ref.kind}
                    id={historicalSeries.result.ref.id}
                    playbookId={definition.id}
                    timeframe={historicalSeries.result.timeframe}
                    setupCandleIndex={
                      view.historical?.meta.replayCursor?.candleIndex ??
                      view.result.evaluation.candleIndex
                    }
                  />
                ) : null
              }
            />
            <DecisionCard evaluation={view.result.evaluation} />
            <DiagnosticsPanel diagnostics={view.diagnostics} history={view.result.history} />
          </div>
          <ConfigurePanel
            definition={definition}
            draft={drafts[definition.id] ?? {}}
            dirty={dirty}
            onChange={(key, value) => updateParameter(definition.id, key, value)}
            onReset={() => resetDraft(definition.id, definition)}
            onApply={() => applyDraft(definition.id, definition)}
          />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <EmptyState
              title={view.title}
              description={view.description}
              icon={view.icon === 'database' ? <Database className="h-6 w-6" /> : <BookOpen className="h-6 w-6" />}
            />
          </div>
          <ConfigurePanel
            definition={definition}
            draft={drafts[definition.id] ?? {}}
            dirty={dirty}
            onChange={(key, value) => updateParameter(definition.id, key, value)}
            onReset={() => resetDraft(definition.id, definition)}
            onApply={() => applyDraft(definition.id, definition)}
          />
        </div>
      )}
    </motion.div>
  )
}

type LabView =
  | {
      type: 'ready'
      result: PlaybookPipelineResult
      diagnostics: PlaybookDiagnostics
      historical: HistoricalEvaluationSuccess | null
    }
  | { type: 'empty'; title: string; description: string; icon: 'book' | 'database' }

function resolveView(input: {
  dataSourceKind: 'demo' | 'historical'
  catalogLoading: boolean
  catalogEmpty: boolean
  catalogError: string | null
  selectedId: string | null
  seriesLoading: boolean
  seriesResult: ReturnType<typeof usePlaybookHistoricalSeries>['result']
  demoResult: PlaybookPipelineResult | null
  historicalOutcome: ReturnType<typeof evaluateHistoricalPlaybook> | null
}): LabView {
  if (input.dataSourceKind === 'demo') {
    if (!input.demoResult?.evaluation) {
      return {
        type: 'empty',
        icon: 'book',
        title: 'No playbook evaluation available',
        description: 'The selected playbook could not be evaluated on the demo series.',
      }
    }
    return {
      type: 'ready',
      result: input.demoResult,
      diagnostics: collectDiagnostics(input.demoResult.history.evaluations),
      historical: null,
    }
  }

  if (input.catalogError) {
    return {
      type: 'empty',
      icon: 'database',
      title: 'Historical sources unavailable',
      description: input.catalogError,
    }
  }

  if (input.catalogLoading) {
    return {
      type: 'empty',
      icon: 'database',
      title: 'Loading historical sources',
      description: 'Reading saved backtests and Dataset Library entries.',
    }
  }

  if (input.catalogEmpty) {
    return {
      type: 'empty',
      icon: 'database',
      title: 'No saved historical datasets',
      description:
        'Run a Backtest Lab session or import candles in Dataset Library. Demo mode is still available as an explicit example — it is not used as a fallback.',
    }
  }

  if (!input.selectedId) {
    return {
      type: 'empty',
      icon: 'database',
      title: 'Select a historical source',
      description: 'Choose a saved backtest or Dataset Library series. Its symbol, timeframe, and candles will be used as stored.',
    }
  }

  if (input.seriesLoading) {
    return {
      type: 'empty',
      icon: 'database',
      title: 'Loading historical candles',
      description: 'Reading the selected backtest/dataset candle series.',
    }
  }

  if (input.seriesResult && !input.seriesResult.ok) {
    return {
      type: 'empty',
      icon: 'database',
      title: titleForLoadCode(input.seriesResult.code),
      description: input.seriesResult.message,
    }
  }

  if (!input.historicalOutcome) {
    return {
      type: 'empty',
      icon: 'database',
      title: 'No playbook evaluation available',
      description: 'The selected historical source could not be evaluated. Demo data was not substituted.',
    }
  }

  if (!input.historicalOutcome.ok) {
    return {
      type: 'empty',
      icon: 'database',
      title: titleForEvalCode(input.historicalOutcome.error.code),
      description: input.historicalOutcome.error.message,
    }
  }

  if (!input.historicalOutcome.result.evaluation) {
    return {
      type: 'empty',
      icon: 'database',
      title: 'Insufficient warmup candles',
      description: 'The series is shorter than the playbook warmup window. Demo data was not substituted.',
    }
  }

  return {
    type: 'ready',
    result: input.historicalOutcome.result,
    diagnostics: input.historicalOutcome.diagnostics,
    historical: input.historicalOutcome,
  }
}

function titleForLoadCode(code: string): string {
  switch (code) {
    case 'missing_candles':
      return 'Dataset missing candles'
    case 'missing_symbol':
      return 'Dataset missing symbol'
    case 'unknown_timeframe':
      return 'Unknown timeframe'
    case 'not_found':
      return 'Historical source not found'
    default:
      return 'Historical source unavailable'
  }
}

function titleForEvalCode(code: string): string {
  switch (code) {
    case 'insufficient_warmup':
      return 'Insufficient warmup candles'
    case 'missing_candles':
      return 'Dataset missing candles'
    case 'unknown_timeframe':
      return 'Unknown timeframe'
    case 'missing_symbol':
      return 'Dataset missing symbol'
    default:
      return 'Historical evaluation failed'
  }
}
