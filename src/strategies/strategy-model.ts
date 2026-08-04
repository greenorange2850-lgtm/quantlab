import { buildResearchReport } from '@/core/research'
import type { PersistedResearchSession } from '@/research/session-archive'
import { resolveOptimizationSummary } from '@/features/research-intelligence/resolve-optimization-summary'
import { resolveStrategyMetadata } from './strategy-metadata-archive'
import type {
  StrategyLifecycle,
  StrategyListFilters,
  StrategyListItem,
  StrategyVersionEntry,
  StrategyViewModel,
} from './types'
import { DEFAULT_STRATEGY_BASE_NAME } from './types'

function resolveLifecycle(
  saved: boolean,
  sessionStatus: string,
  partial?: boolean,
): StrategyLifecycle {
  if (partial || sessionStatus === 'partial' || sessionStatus === 'cancelled') {
    return saved ? 'saved' : 'partial'
  }
  return saved ? 'saved' : 'draft'
}

function buildVersions(entry: PersistedResearchSession): StrategyVersionEntry[] {
  const report = buildResearchReport(entry.session)
  const versions: StrategyVersionEntry[] = []
  let versionNumber = 0

  const baseline = entry.session.baseline
  if (baseline) {
    versions.push({
      id: `${entry.session.id}-baseline`,
      label: 'Baseline',
      versionNumber: versionNumber++,
      parameters: baseline.parameters,
      score: baseline.score,
      changelog: 'Starting parameters before Random Search.',
      createdAt: entry.session.createdAt,
      isCurrent: false,
      isBaseline: true,
    })
  }

  const timeline = entry.session.improvementTimeline ?? []
  for (const event of timeline) {
    versions.push({
      id: event.candidateId,
      label: `Improvement #${versions.filter((v) => !v.isBaseline).length + 1}`,
      versionNumber: versionNumber++,
      parameters: event.parameters,
      score: event.score,
      changelog: `Score improved to ${event.score.toFixed(2)} during ${event.stage ?? 'search'}.`,
      createdAt: entry.session.createdAt + (event.elapsedMs || 0),
      isCurrent: false,
      isBaseline: false,
    })
  }

  const winning =
    report.recommendedCandidate ?? report.bestCandidate ?? null
  if (winning) {
    const alreadyListed = versions.some((v) => v.id === winning.id)
    if (!alreadyListed) {
      versions.push({
        id: winning.id,
        label: 'Winning parameters',
        versionNumber: versionNumber++,
        parameters: winning.parameters,
        score: winning.score,
        changelog: 'Recommended parameters after optimization.',
        createdAt: entry.session.completedAt ?? entry.savedAt,
        isCurrent: true,
        isBaseline: false,
      })
    } else {
      const match = versions.find((v) => v.id === winning.id)
      if (match) {
        match.isCurrent = true
        match.label = 'Winning parameters'
        match.changelog = 'Recommended parameters after optimization.'
      }
    }
  } else if (versions.length > 0) {
    versions[versions.length - 1]!.isCurrent = true
  }

  return versions
}

/** Map archived research + optional metadata → user-facing Strategy. */
export function toStrategyViewModel(entry: PersistedResearchSession): StrategyViewModel {
  const report = buildResearchReport(entry.session)
  const best = report.recommendedCandidate ?? report.bestCandidate
  const capital = report.config.initialCapital
  const netProfit = best?.report.summary.netProfit ?? null
  const maxDrawdown = best?.report.summary.maxDrawdown ?? null
  const roiPercent =
    netProfit === null || capital <= 0 ? null : (netProfit / capital) * 100

  const metadata = resolveStrategyMetadata({
    id: entry.session.id,
    market: report.config.symbol,
    timeframe: report.config.interval.toUpperCase(),
    createdAt: entry.session.createdAt || entry.savedAt,
    savedAt: entry.savedAt,
  })

  return {
    id: entry.session.id,
    name: metadata.name || DEFAULT_STRATEGY_BASE_NAME,
    description: metadata.description,
    lifecycle: resolveLifecycle(
      metadata.saved,
      report.status,
      entry.session.partial,
    ),
    market: report.config.symbol,
    timeframe: report.config.interval.toUpperCase(),
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
    savedAt: metadata.savedAt,
    bestScore: best?.score ?? entry.session.progress.bestScore,
    netProfit,
    roiPercent,
    maxDrawdown,
    totalTrades: best?.report.summary.totalTrades ?? null,
    winningParameters: best?.parameters ?? null,
    bestBacktestId: best?.backtestId ?? null,
    versions: buildVersions(entry),
    report,
    session: entry.session,
    optimization: resolveOptimizationSummary(report),
    metadata,
  }
}

export function toStrategyListItem(entry: PersistedResearchSession): StrategyListItem {
  const strategy = toStrategyViewModel(entry)
  return {
    id: strategy.id,
    name: strategy.name,
    market: strategy.market,
    timeframe: strategy.timeframe,
    lifecycle: strategy.lifecycle,
    createdAt: strategy.createdAt,
    updatedAt: strategy.updatedAt,
    bestScore: strategy.bestScore,
    netProfit: strategy.netProfit,
    roiPercent: strategy.roiPercent,
    maxDrawdown: strategy.maxDrawdown,
    totalTrades: strategy.totalTrades,
    bestBacktestId: strategy.bestBacktestId,
  }
}

export function collectStrategyFilterOptions(items: StrategyListItem[]): {
  markets: string[]
  timeframes: string[]
} {
  const markets = [...new Set(items.map((item) => item.market))].sort()
  const timeframes = [...new Set(items.map((item) => item.timeframe))].sort()
  return { markets, timeframes }
}

export function filterAndSortStrategies(
  items: StrategyListItem[],
  filters: StrategyListFilters,
): StrategyListItem[] {
  const search = filters.search.trim().toLowerCase()

  const filtered = items.filter((item) => {
    if (filters.savedOnly && item.lifecycle !== 'saved') return false
    if (search) {
      const haystack = [item.name, item.market, item.timeframe, item.id]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(search)) return false
    }
    if (filters.market && item.market !== filters.market) return false
    if (filters.timeframe && item.timeframe !== filters.timeframe) return false
    return true
  })

  const sorted = [...filtered]
  switch (filters.sort) {
    case 'profit':
      sorted.sort(
        (a, b) =>
          (b.netProfit ?? Number.NEGATIVE_INFINITY) -
          (a.netProfit ?? Number.NEGATIVE_INFINITY),
      )
      break
    case 'score':
      sorted.sort(
        (a, b) =>
          (b.bestScore ?? Number.NEGATIVE_INFINITY) -
          (a.bestScore ?? Number.NEGATIVE_INFINITY),
      )
      break
    case 'newest':
    default:
      sorted.sort((a, b) => b.updatedAt - a.updatedAt)
      break
  }

  return sorted
}
