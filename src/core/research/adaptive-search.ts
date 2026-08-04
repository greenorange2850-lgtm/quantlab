import { runBacktestPipeline } from '../dashboard/run-backtest-pipeline.js'
import {
  DEFAULT_MA_CROSS_PARAMS,
  type MovingAverageCrossParams,
} from '../strategy/MovingAverageCrossStrategy.js'
import {
  createAdaptiveBatchController,
  createPerfDiagnosticsTracker,
  isPerfDiagnosticsEnabled,
  logRandomSearchPerfDiagnostics,
  yieldToBrowser,
} from './cooperative-schedule.js'
import { UniqueCandidateTracker } from './fingerprint.js'
import {
  buildMetricChanges,
  buildParameterChanges,
  deriveVerdict,
  ratingFromExistingMetrics,
} from './improvement-compare.js'
import {
  estimateSearchSpaceSize,
  fixedStabilityNeighbors,
  sampleNeighborhood,
  selectRefinementCenters,
} from './neighborhood.js'
import { DEFAULT_PLATEAU_EPSILON, DEFAULT_PLATEAU_UNIQUE_WINDOW, detectPlateau } from './plateau.js'
import {
  buildProgressPayload,
  createEmptyProgress,
  createTimingState,
  markPauseEnd,
  markPauseStart,
} from './progress.js'
import { selectRecommendedCandidate } from './recommendation.js'
import { isEligibleCandidate, tallyRejection } from './rejection.js'
import { sampleStrategyParams, validateRandomSearchConfig } from './sampling.js'
import { scoreFromReport } from './scoring.js'
import { emptyStageProgress, resolveStageBudgets } from './stage-budget.js'
import { analyzeStability } from './stability.js'
import type {
  CandidateRejectionReason,
  ImprovementEvent,
  NewBestEvent,
  OptimizationBaseline,
  OptimizationResultSummary,
  OptimizationStageId,
  RandomSearchCandidate,
  RandomSearchLiveStatus,
  ResearchSession,
  RunRandomSearchOptions,
  StageBudgetProgress,
} from './types.js'
import {
  DEFAULT_STAGE_BUDGET,
  OPTIMIZATION_RESULT_SCHEMA_VERSION,
} from './types.js'

function createSessionId(): string {
  return `rs-${Date.now()}`
}

function createCandidateId(index: number): string {
  return `cand-${index}-${Date.now()}`
}

type Tracker = {
  totalCandidates: number
  candidatesTested: number
  candidatesAccepted: number
  candidatesRejected: number
  currentCandidateScore: number | null
  bestScore: number | null
  bestTradeCount: number | null
  bestCandidateParameters: MovingAverageCrossParams | null
  improvementsCount: number
  candidatesSinceLastImprovement: number | null
  stage: OptimizationStageId | null
  stageBudgets: StageBudgetProgress
  uniqueCandidates: number
  duplicatesSkipped: number
  generatedCandidates: number
  baselineScore: number | null
  rawBestScore: number | null
  recommendedScore: number | null
  pausedMs: number
  rejectionReasonCounts: Partial<Record<CandidateRejectionReason, number>>
  plateauDetected: boolean
  lastImprovementEvent: ImprovementEvent | null
  newBestEvent: NewBestEvent | null
}

/**
 * Multi-stage adaptive optimizer:
 * Baseline → Exploration (≈40%) → Refinement (≈40%) → Stability (≈20%).
 *
 * Reuses runBacktestPipeline + existing BacktestReport metrics only.
 * Deterministic for identical seed/ranges/candles/budget.
 */
export async function runAdaptiveSearch(
  options: RunRandomSearchOptions,
): Promise<ResearchSession> {
  const { config, candles, onProgress, signal, pauseController, controls } = options
  const yieldFn = options.yieldFn ?? yieldToBrowser
  const issues = validateRandomSearchConfig({
    iterations: config.iterations,
    parameterRanges: config.parameterRanges,
  })

  const startedAtMs = Date.now()
  const timing = createTimingState(startedAtMs)
  let pausedAccumMs = 0
  const budgets = resolveStageBudgets(config.iterations, config.stageBudget ?? DEFAULT_STAGE_BUDGET)
  const plateauWindow = config.plateauUniqueWindow ?? DEFAULT_PLATEAU_UNIQUE_WINDOW
  const plateauEpsilon = config.plateauEpsilon ?? DEFAULT_PLATEAU_EPSILON
  const autoStop = config.autoStopOnConverge ?? false
  const baseSeed = config.seed ?? Date.now()

  const tracker: Tracker = {
    totalCandidates: budgets.total,
    candidatesTested: 0,
    candidatesAccepted: 0,
    candidatesRejected: 0,
    currentCandidateScore: null,
    bestScore: null,
    bestTradeCount: null,
    bestCandidateParameters: null,
    improvementsCount: 0,
    candidatesSinceLastImprovement: null,
    stage: null,
    stageBudgets: emptyStageProgress(budgets),
    uniqueCandidates: 0,
    duplicatesSkipped: 0,
    generatedCandidates: 0,
    baselineScore: null,
    rawBestScore: null,
    recommendedScore: null,
    pausedMs: 0,
    rejectionReasonCounts: {},
    plateauDetected: false,
    lastImprovementEvent: null,
    newBestEvent: null,
  }

  const session: ResearchSession = {
    id: createSessionId(),
    status: 'running',
    config,
    candidates: [],
    bestCandidateId: null,
    error: null,
    createdAt: startedAtMs,
    completedAt: null,
    progress: createEmptyProgress(budgets.total),
    baseline: null,
    improvementTimeline: [],
    rawBestCandidateId: null,
    recommendedCandidateId: null,
    optimizationResult: null,
    resolvedSeed: baseSeed,
    partial: false,
  }

  const uniqueness = new UniqueCandidateTracker()
  const improvementTimeline: ImprovementEvent[] = []
  const recentBestScores: number[] = []
  let uniqueSinceImprovement = 0
  let spaceExhausted = false
  let plateauResult = detectPlateau({
    uniqueSinceImprovement: 0,
    plateauUniqueWindow: plateauWindow,
    recentBestScores: [],
    plateauEpsilon,
    duplicateRate: 0,
    uniqueCount: 0,
    parameterRanges: config.parameterRanges,
    continued: true,
  })
  let stagesCompleted: OptimizationStageId[] = []
  let stabilityIncomplete = true
  const stabilityNeighbors: RandomSearchCandidate[] = []

  const activeElapsed = () => Math.max(0, Date.now() - startedAtMs - pausedAccumMs)

  const emit = (status: RandomSearchLiveStatus) => {
    tracker.uniqueCandidates = uniqueness.unique
    tracker.duplicatesSkipped = uniqueness.duplicatesSkipped
    tracker.generatedCandidates = uniqueness.generated
    tracker.pausedMs = pausedAccumMs
    tracker.plateauDetected = plateauResult.detected

    const payload = buildProgressPayload(
      {
        totalCandidates: tracker.totalCandidates,
        candidatesTested: tracker.candidatesTested,
        candidatesAccepted: tracker.candidatesAccepted,
        candidatesRejected: tracker.candidatesRejected,
        currentCandidateScore: tracker.currentCandidateScore,
        bestScore: tracker.bestScore,
        bestTradeCount: tracker.bestTradeCount,
        bestCandidateParameters: tracker.bestCandidateParameters,
        improvementsCount: tracker.improvementsCount,
        candidatesSinceLastImprovement: tracker.candidatesSinceLastImprovement,
        justImproved: false,
        status,
      },
      timing,
      Date.now(),
    )

    session.progress = {
      ...payload,
      elapsedMs: activeElapsed(),
      wallElapsedMs: Math.max(0, Date.now() - startedAtMs),
      stage: tracker.stage,
      stageBudgets: {
        ...tracker.stageBudgets,
        exploration: { ...tracker.stageBudgets.exploration },
        refinement: { ...tracker.stageBudgets.refinement },
        stability: { ...tracker.stageBudgets.stability },
        baseline: { ...tracker.stageBudgets.baseline },
      },
      uniqueCandidates: tracker.uniqueCandidates,
      duplicatesSkipped: tracker.duplicatesSkipped,
      generatedCandidates: tracker.generatedCandidates,
      baselineScore: tracker.baselineScore,
      rawBestScore: tracker.rawBestScore,
      recommendedScore: tracker.recommendedScore,
      pausedMs: tracker.pausedMs,
      rejectionReasonCounts: { ...tracker.rejectionReasonCounts },
      plateauDetected: tracker.plateauDetected,
      lastImprovementEvent: tracker.lastImprovementEvent,
      newBestEvent: tracker.newBestEvent,
    }
    onProgress?.({ ...session.progress })
  }

  if (issues.length > 0) {
    session.status = 'failed'
    session.error = issues.map((issue) => issue.message).join('; ')
    session.completedAt = Date.now()
    emit('FAILED')
    return session
  }

  if (!candles.length) {
    session.status = 'failed'
    session.error = 'Candles are required for Adaptive Search'
    session.completedAt = Date.now()
    emit('FAILED')
    return session
  }

  const perf = createPerfDiagnosticsTracker()
  const collectPerf = isPerfDiagnosticsEnabled(options.enablePerfDiagnostics)
  const searchStartedAt = performance.now()

  function finishPerf() {
    if (!collectPerf) return
    const diagnostics = perf.snapshot(performance.now() - searchStartedAt)
    options.onPerfDiagnostics?.(diagnostics)
    if (options.enablePerfDiagnostics !== false) {
      logRandomSearchPerfDiagnostics(diagnostics)
    }
  }

  const batcher = createAdaptiveBatchController({
    fixedBatchSize: options.cooperativeBatchSize,
  })
  let batchStartedAt = performance.now()
  let openBatchCandidates = 0
  let evaluatedIndex = 0

  const closeOpenBatch = () => {
    if (openBatchCandidates <= 0) return
    const durationMs = performance.now() - batchStartedAt
    batcher.recordBatch(openBatchCandidates, durationMs)
    if (collectPerf) perf.noteBatch(openBatchCandidates, durationMs)
    openBatchCandidates = 0
  }

  async function cooperativeYield(beforeIndex: number) {
    if (batcher.shouldYieldBefore(beforeIndex, performance.now())) {
      closeOpenBatch()
      await yieldFn()
      if (collectPerf) perf.noteYield()
      batchStartedAt = performance.now()
    }
  }

  async function handlePause(): Promise<'continue' | 'cancel'> {
    if (controls) {
      return controls.waitIfPaused({
        onPausing: () => emit('PAUSING'),
        onPaused: () => {
          markPauseStart(timing, Date.now())
          emit('PAUSED')
        },
        onResume: () => {
          markPauseEnd(timing, Date.now())
          pausedAccumMs = timing.pausedTotalMs
          tracker.pausedMs = pausedAccumMs
        },
      })
    }

    if (!pauseController?.paused) return 'continue'
    emit('PAUSING')
    const pauseStarted = Date.now()
    emit('PAUSED')
    await pauseController.waitIfPaused()
    pausedAccumMs += Date.now() - pauseStarted
    tracker.pausedMs = pausedAccumMs
    return 'continue'
  }

  function shouldCancel(): boolean {
    return Boolean(signal?.aborted || controls?.getCancelIntent())
  }

  function cancelIsSavePartial(): boolean {
    return controls?.getCancelIntent() === 'save-partial'
  }

  function finishCancelled(partial: boolean): ResearchSession {
    session.status = 'cancelled'
    session.partial = partial
    session.completedAt = Date.now()
    session.improvementTimeline = improvementTimeline
    session.optimizationResult = buildPartialResult()
    if (partial) {
      // Mark as provisional when Stage C did not finish.
      if (session.optimizationResult) {
        session.optimizationResult.stabilityIncomplete = true
      }
    }
    emit('CANCELLED')
    finishPerf()
    return session
  }

  function maybeAbort(): boolean {
    return shouldCancel()
  }

  async function evaluateParameters(
    parameters: MovingAverageCrossParams,
    stage: OptimizationStageId,
    seedOffset: number,
  ): Promise<RandomSearchCandidate | null> {
    const { fingerprint, isNew } = uniqueness.tryAdd(parameters)
    tracker.generatedCandidates = uniqueness.generated
    tracker.duplicatesSkipped = uniqueness.duplicatesSkipped
    tracker.uniqueCandidates = uniqueness.unique

    if (!isNew) {
      tallyRejection(tracker.rejectionReasonCounts, ['duplicate_candidate'])
      return null
    }

    await cooperativeYield(evaluatedIndex)
    if (maybeAbort()) {
      emit('CANCELLING')
      return null
    }
    const pauseGate = await handlePause()
    if (pauseGate === 'cancel' || maybeAbort()) {
      emit('CANCELLING')
      return null
    }

    const pipelineResult = await runBacktestPipeline({
      symbol: config.symbol,
      interval: config.interval,
      limit: config.limit,
      startDate: config.startDate,
      endDate: config.endDate,
      initialCapital: config.initialCapital,
      commissionPercent: config.commissionPercent ?? 0.1,
      positionSizePercent: config.positionSizePercent ?? 100,
      candles,
      strategyParams: parameters,
      strategyVersion: `rs-${parameters.fastPeriod}-${parameters.slowPeriod}-${parameters.rsiPeriod}`,
    })

    const score = scoreFromReport(pipelineResult.report, config.objective)
    const eligibility = isEligibleCandidate(
      pipelineResult.report,
      config.constraints,
      parameters,
    )
    const candidateParams =
      pipelineResult.strategyParams ?? { ...DEFAULT_MA_CROSS_PARAMS, ...parameters }

    const candidate: RandomSearchCandidate = {
      id: createCandidateId(evaluatedIndex),
      parameters: candidateParams,
      score,
      passedConstraints: eligibility.passed,
      report: pipelineResult.report,
      backtestId: pipelineResult.backtestId,
      stage,
      fingerprint,
      rejectionReasons: eligibility.passed ? [] : eligibility.reasons,
    }

    session.candidates.push(candidate)
    evaluatedIndex += 1
    tracker.candidatesTested = evaluatedIndex
    tracker.currentCandidateScore = score

    if (eligibility.passed) {
      tracker.candidatesAccepted += 1
    } else {
      tracker.candidatesRejected += 1
      tallyRejection(tracker.rejectionReasonCounts, eligibility.reasons)
    }

    const previousBest = tracker.bestScore
    const previousPf =
      session.candidates.find((c) => c.id === session.bestCandidateId)?.report.summary
        .profitFactor ?? null
    const previousDd =
      session.candidates.find((c) => c.id === session.bestCandidateId)?.report.summary
        .maxDrawdown ?? null
    const previousTrades = tracker.bestTradeCount

    if (eligibility.passed && (tracker.bestScore === null || score > tracker.bestScore)) {
      tracker.bestScore = score
      tracker.rawBestScore = score
      tracker.bestTradeCount = candidate.report.summary.totalTrades
      tracker.bestCandidateParameters = { ...candidate.parameters }
      session.bestCandidateId = candidate.id
      session.rawBestCandidateId = candidate.id
      tracker.improvementsCount += 1
      tracker.candidatesSinceLastImprovement = 0
      uniqueSinceImprovement = 0

      const event: ImprovementEvent = {
        candidateIndex: evaluatedIndex,
        candidateId: candidate.id,
        stage,
        score,
        parameters: { ...candidate.parameters },
        netProfit: candidate.report.summary.netProfit,
        profitFactor: candidate.report.summary.profitFactor,
        maxDrawdown: candidate.report.summary.maxDrawdown,
        winRate: candidate.report.summary.winRate,
        tradeCount: candidate.report.summary.totalTrades,
        elapsedMs: activeElapsed(),
      }
      improvementTimeline.push(event)
      tracker.lastImprovementEvent = event
      tracker.newBestEvent = {
        previousScore: previousBest,
        score,
        previousProfitFactor: previousPf,
        profitFactor: candidate.report.summary.profitFactor,
        previousMaxDrawdown: previousDd,
        maxDrawdown: candidate.report.summary.maxDrawdown,
        previousTradeCount: previousTrades,
        tradeCount: candidate.report.summary.totalTrades,
        stage,
        atMs: Date.now(),
      }
      recentBestScores.push(score)
      if (recentBestScores.length > 12) recentBestScores.shift()
    } else if (tracker.bestScore !== null) {
      tracker.candidatesSinceLastImprovement =
        (tracker.candidatesSinceLastImprovement ?? 0) + 1
      uniqueSinceImprovement += 1
      tracker.newBestEvent = null
    }

    const duplicateRate =
      uniqueness.generated > 0 ? uniqueness.duplicatesSkipped / uniqueness.generated : 0
    plateauResult = detectPlateau({
      uniqueSinceImprovement,
      plateauUniqueWindow: plateauWindow,
      recentBestScores,
      plateauEpsilon,
      duplicateRate,
      uniqueCount: uniqueness.unique,
      parameterRanges: config.parameterRanges,
      continued: !autoStop,
    })
    tracker.plateauDetected = plateauResult.detected
    if (plateauResult.reason === 'space_exhausted') spaceExhausted = true

    batcher.noteCandidate()
    openBatchCandidates += 1
    void seedOffset

    return candidate
  }

  function liveStatusForStage(stage: OptimizationStageId): RandomSearchLiveStatus {
    if (plateauResult.detected && stage !== 'stability') {
      return autoStop ? 'CONVERGED' : 'PLATEAUING'
    }
    if (tracker.newBestEvent) return 'IMPROVING'
    switch (stage) {
      case 'baseline':
        return 'BASELINE'
      case 'exploration':
        return 'EXPLORING'
      case 'refinement':
        return 'REFINING'
      case 'stability':
        return 'STABILITY_CHECK'
    }
  }

  try {
    emit('INITIALIZING')
    await yieldFn()
    if (collectPerf) perf.noteYield()
    if (maybeAbort()) {
      emit('CANCELLING')
      return finishCancelled(cancelIsSavePartial())
    }

    // ——— Stage: Baseline ———
    tracker.stage = 'baseline'
    emit('BASELINE')
    const baselineParams = {
      ...DEFAULT_MA_CROSS_PARAMS,
      ...config.baselineParameters,
    }
    const baselinePipeline = await runBacktestPipeline({
      symbol: config.symbol,
      interval: config.interval,
      limit: config.limit,
      startDate: config.startDate,
      endDate: config.endDate,
      initialCapital: config.initialCapital,
      commissionPercent: config.commissionPercent ?? 0.1,
      positionSizePercent: config.positionSizePercent ?? 100,
      candles,
      strategyParams: baselineParams,
      strategyVersion: `baseline-${baselineParams.fastPeriod}-${baselineParams.slowPeriod}-${baselineParams.rsiPeriod}`,
    })
    const baselineScore = scoreFromReport(baselinePipeline.report, config.objective)
    const baseline: OptimizationBaseline = {
      parameters: baselineParams,
      report: baselinePipeline.report,
      score: baselineScore,
      researchRating: ratingFromExistingMetrics(baselinePipeline.report.summary),
      tradeCount: baselinePipeline.report.summary.totalTrades,
      netProfit: baselinePipeline.report.summary.netProfit,
      profitFactor: baselinePipeline.report.summary.profitFactor,
      maxDrawdown: baselinePipeline.report.summary.maxDrawdown,
      winRate: baselinePipeline.report.summary.winRate,
      expectancy: baselinePipeline.report.summary.expectancy,
      backtestId: baselinePipeline.backtestId,
    }
    session.baseline = baseline
    tracker.baselineScore = baselineScore
    tracker.stageBudgets.baseline.completed = true
    stagesCompleted.push('baseline')
    uniqueness.tryAdd(baselineParams) // reserve fingerprint so baseline params aren't re-evaluated as "new" wastefully — actually we might want to allow re-eval. Spec says don't waste budget on identical sets. Marking baseline as seen is correct.
    emit('BASELINE')
    await yieldFn()

    // ——— Stage A: Exploration ———
    tracker.stage = 'exploration'
    stagesCompleted.push('exploration')
    let explorationDone = 0
    let exploreAttempts = 0
    const exploreAttemptCap = Math.max(budgets.exploration * 25, budgets.exploration + 20)
    while (explorationDone < budgets.exploration && exploreAttempts < exploreAttemptCap) {
      if (maybeAbort()) break
      const pauseGate = await handlePause()
      if (pauseGate === 'cancel' || maybeAbort()) break
      if (autoStop && plateauResult.detected && explorationDone > budgets.exploration * 0.5) break

      const parameters = sampleStrategyParams(
        config.parameterRanges,
        baseSeed + exploreAttempts,
      )
      exploreAttempts += 1
      const beforeUnique = uniqueness.unique
      const candidate = await evaluateParameters(parameters, 'exploration', exploreAttempts)
      if (uniqueness.unique > beforeUnique || candidate) {
        // Count toward budget only when a new unique set was evaluated
        if (candidate) {
          explorationDone += 1
          tracker.stageBudgets.exploration.done = explorationDone
        }
      }
      // Also count failed unique attempts that were duplicates toward attempt loop only
      if (candidate) {
        emit(liveStatusForStage('exploration'))
      } else if (uniqueness.duplicatesSkipped > 0) {
        emit(liveStatusForStage('exploration'))
      }

      if (uniqueness.unique >= estimateSearchSpaceSize(config.parameterRanges)) {
        spaceExhausted = true
        tallyRejection(tracker.rejectionReasonCounts, ['space_exhausted'])
        break
      }
    }
    // If we couldn't fill budget due to space, record honesty
    if (explorationDone < budgets.exploration && spaceExhausted) {
      tracker.stageBudgets.exploration.done = explorationDone
    }

    if (maybeAbort()) {
      emit('CANCELLING')
      return finishCancelled(cancelIsSavePartial())
    }

    // ——— Stage B: Refinement ———
    tracker.stage = 'refinement'
    stagesCompleted.push('refinement')
    const eligible = session.candidates.filter((c) => c.passedConstraints)
    const centers = selectRefinementCenters(
      eligible.map((c) => ({ parameters: c.parameters, score: c.score })),
      0.15,
      8,
    )
    // Fall back to baseline region if no eligible centers
    if (centers.length === 0) centers.push({ ...baselineParams })

    let refinementDone = 0
    let refineSeed = baseSeed + 10_000
    let refineGuard = 0
    while (refinementDone < budgets.refinement && refineGuard < budgets.refinement * 30) {
      if (maybeAbort()) break
      const pauseGate = await handlePause()
      if (pauseGate === 'cancel' || maybeAbort()) break
      if (autoStop && plateauResult.detected) break

      const center = centers[refineGuard % centers.length]!
      const samples = sampleNeighborhood(
        center,
        config.parameterRanges,
        1,
        refineSeed + refineGuard,
        new Set(
          // exclude already seen via tracker in evaluateParameters
        ),
      )
      refineGuard += 1
      const parameters = samples[0]
      if (!parameters) continue
      const candidate = await evaluateParameters(parameters, 'refinement', refineSeed + refineGuard)
      if (candidate) {
        refinementDone += 1
        tracker.stageBudgets.refinement.done = refinementDone
        emit(liveStatusForStage('refinement'))
      }
    }

    if (maybeAbort()) {
      emit('CANCELLING')
      return finishCancelled(cancelIsSavePartial())
    }

    // ——— Stage C: Stability ———
    tracker.stage = 'stability'
    stagesCompleted.push('stability')
    const rawBest =
      (session.rawBestCandidateId
        ? session.candidates.find((c) => c.id === session.rawBestCandidateId)
        : null) ??
      eligible.sort((a, b) => b.score - a.score)[0] ??
      null

    let stabilityDone = 0
    if (rawBest) {
      const neighbors = fixedStabilityNeighbors(rawBest.parameters, config.parameterRanges)
      // Fill remaining budget with seeded neighborhood samples
      const extra = sampleNeighborhood(
        rawBest.parameters,
        config.parameterRanges,
        Math.max(0, budgets.stability - neighbors.length),
        baseSeed + 20_000,
      )
      const probeParams = [...neighbors, ...extra].slice(0, budgets.stability)

      for (let i = 0; i < probeParams.length; i++) {
        if (maybeAbort()) break
        const pauseGate = await handlePause()
        if (pauseGate === 'cancel' || maybeAbort()) break
        const candidate = await evaluateParameters(
          probeParams[i]!,
          'stability',
          baseSeed + 20_000 + i,
        )
        if (candidate) {
          stabilityDone += 1
          tracker.stageBudgets.stability.done = stabilityDone
          stabilityNeighbors.push(candidate)
          emit(liveStatusForStage('stability'))
        }
      }
      stabilityIncomplete = maybeAbort() || stabilityDone < Math.min(3, budgets.stability)
    } else {
      stabilityIncomplete = true
    }

    closeOpenBatch()

    if (maybeAbort()) {
      emit('CANCELLING')
      return finishCancelled(cancelIsSavePartial())
    }

    // ——— Selection ———
    emit('FINALIZING')
    const eligibleRanked = session.candidates
      .filter((c) => c.passedConstraints)
      .sort((a, b) => b.score - a.score)
    const rawBestFinal = eligibleRanked[0] ?? null
    session.rawBestCandidateId = rawBestFinal?.id ?? null
    tracker.rawBestScore = rawBestFinal?.score ?? null

    const neighborForStability = session.candidates.filter(
      (c) =>
        c.stage === 'stability' ||
        (rawBestFinal &&
          c.id !== rawBestFinal.id &&
          Math.abs(c.parameters.fastPeriod - rawBestFinal.parameters.fastPeriod) <= 2),
    )

    const stability = rawBestFinal
      ? analyzeStability(rawBestFinal.parameters, rawBestFinal.score, neighborForStability)
      : null

    const decision = selectRecommendedCandidate({
      eligibleRanked,
      rawBest: rawBestFinal,
      rawBestStability: stability,
    })

    const recommended =
      (decision.recommendedCandidateId
        ? session.candidates.find((c) => c.id === decision.recommendedCandidateId)
        : null) ?? rawBestFinal

    session.recommendedCandidateId = recommended?.id ?? null
    session.bestCandidateId = recommended?.id ?? rawBestFinal?.id ?? null
    tracker.recommendedScore = recommended?.score ?? null
    tracker.bestScore = recommended?.score ?? tracker.bestScore
    tracker.bestCandidateParameters = recommended?.parameters ?? tracker.bestCandidateParameters
    tracker.bestTradeCount = recommended?.report.summary.totalTrades ?? tracker.bestTradeCount

    const verdict = deriveVerdict({
      baseline,
      recommended: recommended ?? null,
      eligibleCount: eligibleRanked.length,
      stability,
      stabilityIncomplete,
    })

    const metricChanges =
      baseline && recommended
        ? buildMetricChanges(
            baseline.report.summary,
            recommended.report.summary,
            baseline.score,
            recommended.score,
          )
        : []
    const parameterChanges =
      baseline && recommended
        ? buildParameterChanges(baseline.parameters, recommended.parameters)
        : []

    const duplicateRate =
      uniqueness.generated > 0 ? uniqueness.duplicatesSkipped / uniqueness.generated : 0

    const optimizationResult: OptimizationResultSummary = {
      baseline,
      rawBestCandidateId: session.rawBestCandidateId,
      recommendedCandidateId: session.recommendedCandidateId,
      recommendation: decision,
      stability,
      plateau: plateauResult,
      verdict: verdict.verdict,
      verdictDetail: verdict.detail,
      improvements: [...improvementTimeline],
      metricChanges,
      parameterChanges,
      searchExplanation: {
        stagesCompleted,
        candidatesEvaluated: session.candidates.length,
        uniqueCandidates: uniqueness.unique,
        duplicatesSkipped: uniqueness.duplicatesSkipped,
        generatedCandidates: uniqueness.generated,
        duplicateRate,
        improvementCount: improvementTimeline.length,
        lastImprovement: improvementTimeline.at(-1) ?? null,
        plateauDetail: plateauResult.detected ? plateauResult.detail : null,
        stabilitySummary: stability?.summary ?? null,
        spaceExhausted,
      },
      rejectionReasonCounts: { ...tracker.rejectionReasonCounts },
      datasetCandleCount: candles.length,
      datasetStartMs: candles[0]?.time ?? null,
      datasetEndMs: candles.at(-1)?.time ?? null,
      stabilityIncomplete,
      schemaVersion: OPTIMIZATION_RESULT_SCHEMA_VERSION,
    }

    session.improvementTimeline = improvementTimeline
    session.optimizationResult = optimizationResult
    session.status = 'completed'
    session.completedAt = Date.now()
    emit('FINALIZING')
    finishPerf()
    return session
  } catch (error: unknown) {
    closeOpenBatch()
    if (maybeAbort()) {
      emit('CANCELLING')
      return finishCancelled(cancelIsSavePartial())
    }
    session.status = 'failed'
    session.error = error instanceof Error ? error.message : 'Adaptive Search failed'
    session.completedAt = Date.now()
    emit('FAILED')
    finishPerf()
    return session
  }

  function buildPartialResult(): OptimizationResultSummary {
    const eligibleRanked = session.candidates
      .filter((c) => c.passedConstraints)
      .sort((a, b) => b.score - a.score)
    const rawBestFinal = eligibleRanked[0] ?? null
    const decision = selectRecommendedCandidate({
      eligibleRanked,
      rawBest: rawBestFinal,
      rawBestStability: null,
    })
    const recommended =
      (decision.recommendedCandidateId
        ? session.candidates.find((c) => c.id === decision.recommendedCandidateId)
        : null) ?? rawBestFinal
    const verdict = deriveVerdict({
      baseline: session.baseline ?? null,
      recommended: recommended ?? null,
      eligibleCount: eligibleRanked.length,
      stability: null,
      stabilityIncomplete: true,
    })
    return {
      baseline: session.baseline ?? null,
      rawBestCandidateId: rawBestFinal?.id ?? null,
      recommendedCandidateId: recommended?.id ?? null,
      recommendation: decision,
      stability: null,
      plateau: plateauResult,
      verdict: verdict.verdict,
      verdictDetail: `Partial Optimization Result. Search stopped after ${tracker.candidatesTested} / ${tracker.totalCandidates} candidates. The current best is provisional. Stability analysis was incomplete.`,
      improvements: [...improvementTimeline],
      metricChanges:
        session.baseline && recommended
          ? buildMetricChanges(
              session.baseline.report.summary,
              recommended.report.summary,
              session.baseline.score,
              recommended.score,
            )
          : [],
      parameterChanges:
        session.baseline && recommended
          ? buildParameterChanges(session.baseline.parameters, recommended.parameters)
          : [],
      searchExplanation: {
        stagesCompleted,
        candidatesEvaluated: session.candidates.length,
        uniqueCandidates: uniqueness.unique,
        duplicatesSkipped: uniqueness.duplicatesSkipped,
        generatedCandidates: uniqueness.generated,
        duplicateRate:
          uniqueness.generated > 0 ? uniqueness.duplicatesSkipped / uniqueness.generated : 0,
        improvementCount: improvementTimeline.length,
        lastImprovement: improvementTimeline.at(-1) ?? null,
        plateauDetail: plateauResult.detected ? plateauResult.detail : null,
        stabilitySummary: null,
        spaceExhausted,
      },
      rejectionReasonCounts: { ...tracker.rejectionReasonCounts },
      datasetCandleCount: candles.length,
      datasetStartMs: candles[0]?.time ?? null,
      datasetEndMs: candles.at(-1)?.time ?? null,
      stabilityIncomplete: true,
      schemaVersion: OPTIMIZATION_RESULT_SCHEMA_VERSION,
    }
  }
}
