import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  Library,
  RefreshCw,
  Save,
  SlidersHorizontal,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useSaveStrategy,
  useStrategy,
  useStrategyArchiveReady,
} from '@/api/queries/strategies'
import { shouldAwaitResearchArchive } from '@/research/ui-gates'
import {
  STRATEGY_TABS,
  type StrategyTabId,
} from '@/strategies'
import { OverviewTab } from './tabs/OverviewTab'
import { OptimizationTab } from './tabs/OptimizationTab'
import { ParametersTab } from './tabs/ParametersTab'
import { ReplayTab } from './tabs/ReplayTab'
import { EquityTab } from './tabs/EquityTab'
import { AiAnalysisTab } from './tabs/AiAnalysisTab'
import { VersionsTab } from './tabs/VersionsTab'

function isStrategyTab(value: string | null): value is StrategyTabId {
  return STRATEGY_TABS.some((tab) => tab.id === value)
}

function WorkspaceSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-full max-w-md rounded-lg" />
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}

/**
 * Strategy-first workspace. Research session ids power the route but are not
 * presented as “Research Sessions” in product copy.
 */
export function StrategyWorkspacePage() {
  const { strategyId } = useParams<{ strategyId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const archiveReady = useStrategyArchiveReady()
  const strategyQuery = useStrategy(strategyId ?? null)
  const saveMutation = useSaveStrategy()

  const tabParam = searchParams.get('tab')
  const activeTab: StrategyTabId = isStrategyTab(tabParam) ? tabParam : 'overview'

  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveDescription, setSaveDescription] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)

  const strategy = strategyQuery.data

  useEffect(() => {
    if (!strategy) return
    setSaveName(strategy.name)
    setSaveDescription(strategy.description)
  }, [strategy])

  const setTab = (tab: StrategyTabId) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  const awaitingHydration = shouldAwaitResearchArchive({
    archiveReady,
    hasData: Boolean(strategy),
    isPending:
      strategyQuery.isLoading || strategyQuery.isFetching || strategyQuery.isPending,
  })

  const needsSave = strategy?.lifecycle === 'draft' || strategy?.lifecycle === 'partial'

  const tabContent = useMemo(() => {
    if (!strategy) return null
    switch (activeTab) {
      case 'overview':
        return <OverviewTab strategy={strategy} onGoToTab={(tab) => setTab(tab as StrategyTabId)} />
      case 'optimization':
        return (
          <OptimizationTab
            strategy={strategy}
            onContinueToReplay={() => setTab('replay')}
          />
        )
      case 'parameters':
        return <ParametersTab strategy={strategy} />
      case 'replay':
        return (
          <ReplayTab
            strategy={strategy}
            showSaveCta={Boolean(needsSave)}
            onContinueToSave={() => setSaveOpen(true)}
          />
        )
      case 'equity':
        return <EquityTab strategy={strategy} />
      case 'ai':
        return <AiAnalysisTab strategy={strategy} />
      case 'versions':
        return <VersionsTab strategy={strategy} />
      default:
        return null
    }
  }, [strategy, activeTab, needsSave])

  if (awaitingHydration) {
    return (
      <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4">
        <WorkspaceSkeleton />
      </div>
    )
  }

  if (strategyQuery.isError) {
    return (
      <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4">
        <Card hover={false} className="border-danger/30 bg-danger/10">
          <CardContent className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-2 text-sm text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="text-pretty">
                {strategyQuery.error instanceof Error
                  ? strategyQuery.error.message
                  : 'Failed to load strategy'}
              </span>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 w-full sm:min-h-9 sm:w-auto"
              onClick={() => void strategyQuery.refetch()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!strategy) {
    return (
      <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4">
        <Card hover={false} className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm font-medium">Strategy not found</p>
            <p className="text-xs text-muted-foreground">
              It may have been deleted, or New Research has not finished yet.
            </p>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Link to="/strategies" className="w-full sm:w-auto">
                <Button variant="secondary" className="min-h-11 w-full sm:min-h-9 sm:w-auto">
                  <Library className="mr-2 h-4 w-4" />
                  Strategy Library
                </Button>
              </Link>
              <Link to="/optimizer" className="w-full sm:w-auto">
                <Button className="min-h-11 w-full sm:min-h-9 sm:w-auto">
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  New Research
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleSave = () => {
    setSaveError(null)
    const name = saveName.trim()
    if (!name) {
      setSaveError('Give this strategy a name.')
      return
    }
    saveMutation.mutate(
      {
        id: strategy.id,
        name,
        description: saveDescription,
        market: strategy.market,
        timeframe: strategy.timeframe,
      },
      {
        onSuccess: () => {
          setSaveOpen(false)
          void strategyQuery.refetch()
          navigate('/strategies')
        },
        onError: (error) => {
          setSaveError(error instanceof Error ? error.message : 'Failed to save strategy')
        },
      },
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 space-y-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <h2 className="text-lg font-semibold tracking-tight">{strategy.name}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px]">
              {strategy.market}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {strategy.timeframe}
            </Badge>
            <Badge variant="outline" className="capitalize text-[10px]">
              {strategy.lifecycle}
            </Badge>
          </div>
          <p className="text-pretty text-xs text-muted-foreground">
            Random Search is complete. Review the strategy, validate trades, then save to the
            library.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Link to="/strategies" className="w-full sm:w-auto">
            <Button variant="outline" className="min-h-11 w-full sm:min-h-9 sm:w-auto">
              <Library className="mr-2 h-4 w-4" />
              Library
            </Button>
          </Link>
          {needsSave || strategy.lifecycle === 'saved' ? (
            <Button
              className="min-h-11 w-full sm:min-h-9 sm:w-auto"
              onClick={() => setSaveOpen(true)}
            >
              <Save className="mr-2 h-4 w-4" />
              {strategy.lifecycle === 'saved' ? 'Update Strategy' : 'Save Strategy'}
            </Button>
          ) : null}
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Strategy sections"
        className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1"
      >
        {STRATEGY_TABS.map((tab) => {
          const selected = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={
                selected
                  ? 'shrink-0 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-medium text-foreground'
                  : 'shrink-0 rounded-lg border border-transparent px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-white/[0.04]'
              }
              onClick={() => setTab(tab.id)}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
        >
          {tabContent}
        </motion.div>
      </AnimatePresence>

      {saveOpen ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <Card hover={false} className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-base">Save Strategy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Promote this result into your Strategy Library. The underlying search run stays
                an internal detail.
              </p>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Name
                </label>
                <Input
                  value={saveName}
                  onChange={(event) => setSaveName(event.target.value)}
                  className="bg-white/[0.03]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Description
                </label>
                <Input
                  value={saveDescription}
                  onChange={(event) => setSaveDescription(event.target.value)}
                  placeholder="Optional notes"
                  className="bg-white/[0.03]"
                />
              </div>
              {saveError ? (
                <p className="text-xs text-danger">{saveError}</p>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-11 w-full sm:min-h-9 sm:w-auto"
                  onClick={() => setSaveOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="min-h-11 w-full sm:min-h-9 sm:w-auto"
                  disabled={saveMutation.isPending}
                  onClick={handleSave}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save to Library
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
