import { create } from 'zustand'
import type { Candle } from '@/data/candles'
import {
  buildResearchReport,
  createEmptyProgress,
  createThrottledProgressHandler,
  DEFAULT_MA_CROSS_RANGES,
  runRandomSearch,
  validateRandomSearchConfig,
  type RandomSearchConfig,
  type RandomSearchProgress,
  type ResearchReport,
  type ResearchSession,
  type ScoringObjective,
} from '@/core/research'
import type { MovingAverageCrossParams } from '@/core/strategy'
import { DEFAULT_MA_CROSS_PARAMS } from '@/core/strategy'
import {
  saveResearchSession,
  type PersistedResearchSession,
} from '@/research/session-archive'
import { syncResearchSessionQueries } from '@/api/queries/research-sessions'
import { saveBacktestDetail } from '@/backtests/detail-archive'
import { buildPersistedDetail } from '@/backtests/restore-dashboard'
import { createBacktestSummaryFromReport } from '@/core/dashboard'

export type ResearchUiStatus =
  | 'idle'
  | 'running'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'empty'

export type StartRandomSearchResult = {
  session: ResearchSession
  report: ResearchReport
  /** True when a completed Research Session was persisted. */
  persisted: boolean
}

interface ResearchState {
  status: ResearchUiStatus
  progress: RandomSearchProgress | null
  session: ResearchSession | null
  report: ResearchReport | null
  error: string | null
  validationErrors: string[]
  /** Applied to Strategy Lab form — does not auto-run or save. */
  appliedParameters: MovingAverageCrossParams | null
  selectedCandidateId: string | null
  abortController: AbortController | null

  startRandomSearch: (input: {
    config: RandomSearchConfig
    candles: Candle[]
  }) => Promise<StartRandomSearchResult | null>
  cancelRandomSearch: () => void
  applyParameters: (params: MovingAverageCrossParams) => void
  clearAppliedParameters: () => void
  selectCandidate: (id: string | null) => void
  hydrateFromPersistedSession: (entry: PersistedResearchSession) => void
  clearError: () => void
  reset: () => void
}

function markProgressCompleted(progress: RandomSearchProgress): RandomSearchProgress {
  return {
    ...progress,
    status: 'COMPLETED',
    estimatedRemainingMs: 0,
  }
}

export const useResearchStore = create<ResearchState>((set, get) => ({
  status: 'idle',
  progress: null,
  session: null,
  report: null,
  error: null,
  validationErrors: [],
  appliedParameters: null,
  selectedCandidateId: null,
  abortController: null,

  clearError: () => set({ error: null, validationErrors: [] }),

  reset: () => {
    get().abortController?.abort()
    set({
      status: 'idle',
      progress: null,
      session: null,
      report: null,
      error: null,
      validationErrors: [],
      selectedCandidateId: null,
      abortController: null,
    })
  },

  applyParameters: (params) => {
    set({ appliedParameters: { ...params } })
  },

  clearAppliedParameters: () => set({ appliedParameters: null }),

  selectCandidate: (id) => set({ selectedCandidateId: id }),

  hydrateFromPersistedSession: (entry) => {
    if (get().status === 'running') return
    const status: ResearchUiStatus =
      entry.session.status === 'completed' && entry.report.topCandidates.length === 0
        ? 'empty'
        : entry.session.status === 'idle'
          ? 'idle'
          : entry.session.status

    set({
      status,
      session: entry.session,
      report: entry.report,
      progress: markProgressCompleted(entry.session.progress),
      error: entry.session.error,
      selectedCandidateId: entry.report.bestCandidate?.id ?? null,
      validationErrors: [],
    })
  },

  cancelRandomSearch: () => {
    const controller = get().abortController
    if (!controller || get().status !== 'running') return
    controller.abort()
  },

  startRandomSearch: async ({ config, candles }) => {
    if (get().status === 'running') {
      set({
        error: 'A Random Search is already running',
        validationErrors: ['A Random Search is already running'],
      })
      return null
    }

    const issues = validateRandomSearchConfig({
      iterations: config.iterations,
      parameterRanges: config.parameterRanges,
    })
    if (issues.length > 0) {
      set({
        status: 'failed',
        validationErrors: issues.map((issue) => issue.message),
        error: issues.map((issue) => issue.message).join('; '),
        progress: {
          ...createEmptyProgress(config.iterations),
          status: 'FAILED',
        },
      })
      return null
    }

    const controller = new AbortController()
    const throttled = createThrottledProgressHandler((progress) => {
      set({ progress })
    })

    set({
      status: 'running',
      progress: createEmptyProgress(config.iterations),
      session: null,
      report: null,
      error: null,
      validationErrors: [],
      selectedCandidateId: null,
      abortController: controller,
    })

    const session = await runRandomSearch({
      config,
      candles,
      signal: controller.signal,
      onProgress: (progress) => {
        throttled.emit(progress)
      },
    })

    throttled.flush()
    throttled.dispose()

    const report = buildResearchReport(session)

    // Persist only the final completed Research Session — never mid-run progress,
    // cancelled, or failed partial runs.
    let persisted = false
    if (session.status === 'completed') {
      const completedProgress = markProgressCompleted(session.progress)
      session.progress = completedProgress

      saveResearchSession({ session, report, savedAt: Date.now() })
      syncResearchSessionQueries()
      persisted = true

      for (const candidate of session.candidates) {
        const summary = createBacktestSummaryFromReport(
          candidate.report,
          {
            strategyName: 'Moving Average Cross',
            strategyVersion: `rs-${candidate.parameters.fastPeriod}-${candidate.parameters.slowPeriod}-${candidate.parameters.rsiPeriod}`,
            timeframe: config.interval.toUpperCase(),
          },
          candidate.backtestId,
        )
        saveBacktestDetail(
          buildPersistedDetail({
            id: candidate.backtestId,
            report: candidate.report,
            context: {
              strategyName: 'Moving Average Cross',
              strategyVersion: summary.version,
              timeframe: summary.timeframe,
              // Omit candles — shared localStorage quota with research sessions.
              // Report metrics are enough to restore dashboards without rerun.
            },
            existingSummary: summary,
          }),
        )
      }

      // COMPLETED only after the Research Session is safely stored.
      set({
        progress: completedProgress,
      })
    }

    let status: ResearchUiStatus = session.status
    if (session.status === 'completed' && report.topCandidates.length === 0) {
      status = 'empty'
    }

    set({
      status,
      session,
      report,
      progress: session.progress,
      error: session.error,
      abortController: null,
      selectedCandidateId: report.bestCandidate?.id ?? null,
    })

    return { session, report, persisted }
  },
}))

export const defaultRandomSearchDraft = {
  iterations: 20,
  objective: 'profitFactor' as ScoringObjective,
  parameterRanges: DEFAULT_MA_CROSS_RANGES,
  maxDrawdownPercent: '' as string,
  minimumTrades: '' as string,
  minimumProfitFactor: '' as string,
  strategyParams: { ...DEFAULT_MA_CROSS_PARAMS },
}
