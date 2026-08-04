import { create } from 'zustand'
import type { Candle } from '@/data/candles'
import {
  buildResearchReport,
  createEmptyProgress,
  createRandomSearchRunControls,
  createThrottledProgressHandler,
  DEFAULT_MA_CROSS_RANGES,
  runRandomSearch,
  validateRandomSearchConfig,
  type RandomSearchConfig,
  type RandomSearchProgress,
  type RandomSearchRunControls,
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
import { registerStrategyDraftFromSession } from '@/api/queries/strategies'
import { saveBacktestDetail } from '@/backtests/detail-archive'
import { buildPersistedDetail } from '@/backtests/restore-dashboard'
import { createBacktestSummaryFromReport } from '@/core/dashboard'

export type ResearchUiStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'cancelling'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'empty'
  | 'partial'

export type StartRandomSearchResult = {
  session: ResearchSession
  report: ResearchReport
  /** True when a Research Session was persisted (completed or saved partial). */
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
  runControls: RandomSearchRunControls | null
  /** Cancel confirmation dialog visibility (UI only). */
  cancelDialogOpen: boolean
  /** Non-blocking Page Visibility warning while research is active. */
  backgroundWarningVisible: boolean

  startRandomSearch: (input: {
    config: RandomSearchConfig
    candles: Candle[]
  }) => Promise<StartRandomSearchResult | null>
  pauseRandomSearch: () => void
  resumeRandomSearch: () => void
  /** Open cancel confirmation — does not abort yet. */
  openCancelDialog: () => void
  /** Close dialog and keep researching. */
  dismissCancelDialog: () => void
  /** Abort without persisting. */
  confirmDiscardProgress: () => void
  /** Stop after current candidate and persist a partial CANCELLED session. */
  confirmSavePartialResult: () => void
  /** @deprecated Prefer openCancelDialog — kept for older call sites. */
  cancelRandomSearch: () => void
  setBackgroundWarningVisible: (visible: boolean) => void
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

function archiveCandidateDetails(
  session: ResearchSession,
  config: RandomSearchConfig,
): void {
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
        },
        existingSummary: summary,
      }),
    )
  }
}

function isBusyStatus(status: ResearchUiStatus): boolean {
  return status === 'running' || status === 'paused' || status === 'cancelling'
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
  runControls: null,
  cancelDialogOpen: false,
  backgroundWarningVisible: false,

  clearError: () => set({ error: null, validationErrors: [] }),

  setBackgroundWarningVisible: (visible) => set({ backgroundWarningVisible: visible }),

  reset: () => {
    get().abortController?.abort()
    get().runControls?.requestCancel('discard')
    set({
      status: 'idle',
      progress: null,
      session: null,
      report: null,
      error: null,
      validationErrors: [],
      selectedCandidateId: null,
      abortController: null,
      runControls: null,
      cancelDialogOpen: false,
      backgroundWarningVisible: false,
    })
  },

  applyParameters: (params) => {
    set({ appliedParameters: { ...params } })
  },

  clearAppliedParameters: () => set({ appliedParameters: null }),

  selectCandidate: (id) => set({ selectedCandidateId: id }),

  hydrateFromPersistedSession: (entry) => {
    if (isBusyStatus(get().status)) return
    const status: ResearchUiStatus =
      entry.session.status === 'completed' && entry.report.topCandidates.length === 0
        ? 'empty'
        : entry.session.status === 'idle'
          ? 'idle'
          : entry.session.status

    const progress =
      entry.session.status === 'completed' && !entry.session.partial
        ? markProgressCompleted(entry.session.progress)
        : entry.session.progress

    set({
      status,
      session: entry.session,
      report: entry.report,
      progress,
      error: entry.session.error,
      selectedCandidateId:
        entry.report.recommendedCandidate?.id ??
        entry.report.bestCandidate?.id ??
        null,
      validationErrors: [],
      cancelDialogOpen: false,
      backgroundWarningVisible: false,
    })
  },

  pauseRandomSearch: () => {
    const { status, runControls, progress } = get()
    if (!runControls) return
    if (status === 'cancelling') return
    if (status !== 'running' && progress?.status !== 'PAUSING') return
    if (progress?.status === 'PAUSED' || progress?.status === 'PAUSING') return
    runControls.requestPause()
  },

  resumeRandomSearch: () => {
    const { status, runControls } = get()
    if (!runControls) return
    if (status === 'cancelling') return
    if (status !== 'paused' && get().progress?.status !== 'PAUSED') return
    runControls.resume()
    set({ status: 'running', cancelDialogOpen: false })
  },

  openCancelDialog: () => {
    const { status } = get()
    if (status === 'cancelling') return
    if (status !== 'running' && status !== 'paused') return
    set({ cancelDialogOpen: true })
  },

  dismissCancelDialog: () => {
    if (get().status === 'cancelling') return
    set({ cancelDialogOpen: false })
  },

  confirmDiscardProgress: () => {
    const { status, runControls, abortController } = get()
    if (status === 'cancelling') return
    if (!runControls || (status !== 'running' && status !== 'paused')) return
    set({
      cancelDialogOpen: false,
      status: 'cancelling',
      progress: get().progress
        ? { ...get().progress!, status: 'CANCELLING' }
        : get().progress,
    })
    runControls.requestCancel('discard')
    abortController?.abort()
  },

  confirmSavePartialResult: () => {
    const { status, runControls, abortController } = get()
    if (status === 'cancelling') return
    if (!runControls || (status !== 'running' && status !== 'paused')) return
    set({
      cancelDialogOpen: false,
      status: 'cancelling',
      progress: get().progress
        ? { ...get().progress!, status: 'CANCELLING' }
        : get().progress,
    })
    runControls.requestCancel('save-partial')
    // Do not abort via signal alone — controls drive save-partial path.
    // Abort still wakes cooperative waits if needed.
    abortController?.abort()
  },

  cancelRandomSearch: () => {
    get().openCancelDialog()
  },

  startRandomSearch: async ({ config, candles }) => {
    if (isBusyStatus(get().status)) {
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
    const runControls = createRandomSearchRunControls()
    const throttled = createThrottledProgressHandler((progress) => {
      const nextStatus: ResearchUiStatus =
        progress.status === 'PAUSED' || progress.status === 'PAUSING'
          ? 'paused'
          : progress.status === 'CANCELLING'
            ? 'cancelling'
            : get().status === 'cancelling'
              ? 'cancelling'
              : 'running'
      set({
        progress,
        status:
          get().status === 'cancelling' && progress.status !== 'CANCELLED'
            ? 'cancelling'
            : nextStatus === 'running' && get().status === 'paused'
              ? 'running'
              : nextStatus,
      })
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
      runControls,
      cancelDialogOpen: false,
      backgroundWarningVisible: false,
    })

    const session = await runRandomSearch({
      config,
      candles,
      signal: controller.signal,
      controls: runControls,
      onProgress: (progress) => {
        throttled.emit(progress)
      },
    })

    throttled.flush()
    throttled.dispose()

    const report = buildResearchReport(session)

    let persisted = false
    const shouldPersistCompleted = session.status === 'completed'
    const shouldPersistPartial =
      session.status === 'cancelled' && session.partial === true

    if (shouldPersistCompleted || shouldPersistPartial) {
      if (shouldPersistCompleted) {
        session.progress = markProgressCompleted(session.progress)
      }

      const persistedEntry = { session, report, savedAt: Date.now() }
      saveResearchSession(persistedEntry)
      syncResearchSessionQueries()
      // Draft Strategy shell — Random Search remains temporary until Save Strategy.
      registerStrategyDraftFromSession(persistedEntry)
      persisted = true
      archiveCandidateDetails(session, config)

      if (shouldPersistCompleted) {
        set({ progress: session.progress })
      }
    }

    let status: ResearchUiStatus = session.status
    if (session.status === 'completed' && report.topCandidates.length === 0) {
      status = 'empty'
    }
    if (session.status === 'cancelled' && session.partial) {
      status = 'partial'
    }

    set({
      status,
      session,
      report,
      progress: session.progress,
      error: session.error,
      abortController: null,
      runControls: null,
      cancelDialogOpen: false,
      selectedCandidateId:
        report.recommendedCandidate?.id ??
        report.bestCandidate?.id ??
        null,
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
  searchPreset: 'balanced' as const,
  autoStopOnConverge: false,
}
