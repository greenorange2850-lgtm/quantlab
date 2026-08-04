import { describe, expect, it } from 'vitest'
import { emptyDowTheoryLayer } from '@/core/smc'
import type { SetupCheck, SetupEngineResult, TradingSetup } from '@/core/setup'
import { emptySetupEngineResult } from '@/core/setup'
import {
  buildMarketDecisionView,
  humanCheckLabel,
  humanMissingCondition,
  humanQmlStatus,
  humanSetupType,
  preferredDirectionLabel,
  structureNarrative,
} from '../analyze/trader-language'

function check(partial: Partial<SetupCheck> & Pick<SetupCheck, 'name' | 'passed'>): SetupCheck {
  return {
    required: true,
    reason: 'test',
    sourceIds: [],
    ...partial,
  }
}

function setup(partial?: Partial<TradingSetup>): TradingSetup {
  return {
    id: 'setup-1',
    setupType: 'BEARISH_CONTINUATION',
    direction: 'BEARISH',
    status: 'WAITING_RETEST',
    strength: { score: 91, reasons: [] },
    trendContext: 'Bearish / IMPULSE',
    entryZone: { low: 100, high: 104, sourceKind: 'ORDER_BLOCK', sourceId: 'ob-1' },
    stopReference: { level: 104, reason: 'stop', sourceId: 'ob-1' },
    targetCandidates: [],
    requiredChecks: [
      check({ name: 'Trend', passed: true }),
      check({ name: 'BOS', passed: true }),
      check({ name: 'OB', passed: true }),
      check({ name: 'FVG', passed: true }),
      check({ name: 'Retest', passed: false }),
    ],
    optionalChecks: [],
    missingChecks: ['Retest'],
    eventChain: [],
    warnings: [],
    reason: 'Bearish continuation waiting for retest',
    createdIndex: 10,
    updatedIndex: 20,
    riskNotes: [],
    suggestedTarget: null,
    conflictIds: [],
    ...partial,
  }
}

describe('trader-language presentation helpers', () => {
  it('never surfaces Dow Theory as a missing condition label', () => {
    expect(humanMissingCondition('Dow Theory')).toBe('Market structure not confirmed')
    expect(humanMissingCondition('Retest')).toBe('Price has not retested the entry zone')
    expect(humanMissingCondition('Sweep')).toBe('Liquidity sweep missing')
    expect(humanCheckLabel(check({ name: 'Dow Theory', passed: true }))).toBe(
      'Market structure confirmed',
    )
    expect(humanCheckLabel(check({ name: 'Zone Lifecycle', passed: false }))).toBe(
      'Entry zone no longer valid',
    )
  })

  it('builds a trader Market Decision view from engine outputs', () => {
    const s = setup()
    const result: SetupEngineResult = {
      ...emptySetupEngineResult(30),
      setups: [s],
      rankedSetupIds: [s.id],
      summary: {
        stance: 'WAIT',
        highestRanked: s,
        buyReadyCount: 0,
        sellReadyCount: 0,
        watchingCount: 0,
        waitingRetestCount: 1,
        invalidatedCount: 0,
        expiredCount: 0,
        completedCount: 0,
        strength: 91,
        reason: s.reason,
        missingConditions: ['Retest'],
        conflictCount: 0,
      },
    }
    const dow = {
      ...emptyDowTheoryLayer(30),
      trend: 'Bearish' as const,
      strength: 80,
      structurePhase: 'IMPULSE' as const,
    }
    const view = buildMarketDecisionView(result, dow, null)
    expect(view.side).toBe('SELL')
    expect(view.phase).toBe('WAIT FOR RETEST')
    expect(view.confidence).toBe(91)
    expect(view.marketLabel).toBe('Bearish')
    expect(view.setupLabel).toBe('Bearish Continuation')
    expect(view.nextAction).toBe('Wait for price to revisit the entry zone.')
    expect(view.stillWaiting).toContain('Price has not retested the entry zone')
    expect(view.reasonRows.some((r) => r.label === 'Trend confirmed' && r.passed)).toBe(true)
    expect(view.reasonRows.some((r) => r.label.includes('Retest') || r.label.includes('retested'))).toBe(
      true,
    )
  })

  it('maps market structure narrative without HH/HL primary copy', () => {
    const dow = {
      ...emptyDowTheoryLayer(10),
      trend: 'Bearish' as const,
      strength: 75,
    }
    expect(preferredDirectionLabel(dow.trend)).toBe('SELL ONLY')
    expect(structureNarrative(dow).join(' ')).toMatch(/Lower Highs/)
    expect(structureNarrative(dow).join(' ')).not.toMatch(/\bHH\b/)
  })

  it('explains setup progress states in one sentence', () => {
    const ready = humanQmlStatus('ENTRY_READY')
    expect(ready.title).toBe('Entry Ready')
    expect(ready.explanation.length).toBeGreaterThan(10)
    const wait = humanQmlStatus('ZONE_ACTIVE')
    expect(wait.title).toBe('Waiting for retest')
    expect(wait.explanation.toLowerCase()).toContain('entry zone')
    expect(humanSetupType('BULLISH_QML')).toBe('Bullish Reversal Level')
  })
})

describe('Analyze workspace trader-first hierarchy', () => {
  it('orders Market Decision before chart and keeps engine names out of primary titles', async () => {
    const { readFileSync } = await import('node:fs')
    const { resolve } = await import('node:path')
    const src = readFileSync(
      resolve(process.cwd(), 'src/features/smc-lab/workspace/SmcAnalyzeWorkspace.tsx'),
      'utf8',
    )
    const decision = src.indexOf('<MarketDecisionCard')
    const structure = src.indexOf('<MarketStructureCard')
    const progress = src.indexOf('<SetupProgressCard')
    const chart = src.indexOf('<SmcCandlestickChart')
    const inspector = src.indexOf('<SetupInspector')
    const replay = src.indexOf('>Replay<')
    const advanced = src.indexOf('Advanced details')
    expect(decision).toBeGreaterThan(-1)
    expect(structure).toBeGreaterThan(decision)
    expect(progress).toBeGreaterThan(structure)
    expect(chart).toBeGreaterThan(progress)
    expect(inspector).toBeGreaterThan(chart)
    expect(replay).toBeGreaterThan(inspector)
    expect(advanced).toBeGreaterThan(replay)
    // Primary titles should not lead with engine jargon
    expect(src).not.toMatch(/CardTitle className="text-sm">Dow Theory</)
    expect(src).not.toMatch(/CardTitle className="text-sm">QML/)
    expect(src).not.toMatch(/CardTitle className="text-sm">Setup Summary</)
  })
})
