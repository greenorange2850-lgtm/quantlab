import { describe, expect, it } from 'vitest'
import { BUILTIN_PLAYBOOKS } from '../index.js'
import { demoDefinition, demoDiagnostics, demoPipelineResult } from '../demo.js'

describe('playbook demo data', () => {
  it('resolves every built-in playbook definition', () => {
    for (const d of BUILTIN_PLAYBOOKS) {
      expect(demoDefinition(d.id).id).toBe(d.id)
    }
  })

  it('rejects unknown playbook ids', () => {
    expect(() => demoDefinition('nope')).toThrow(/Unknown playbook/)
  })

  it('produces a pipeline result for every built-in playbook', () => {
    for (const d of BUILTIN_PLAYBOOKS) {
      const result = demoPipelineResult(d.id)
      expect(result.history.evaluations.length).toBeGreaterThan(0)
      expect(result.evaluation).toBe(result.history.evaluations[result.history.evaluations.length - 1])
      expect(result.detectorOutputsUnchanged).toBe(true)
      expect(result.durationMs).toBeGreaterThanOrEqual(0)
    }
  })

  it('produces a READY bullish QML evaluation with a zone', () => {
    const result = demoPipelineResult('bullish-qml-reversal')
    expect(result.evaluation.direction).toBe('long')
    expect(result.evaluation.action).toBe('BUY')
    expect(result.evaluation.status).toBe('READY')
    expect(result.evaluation.entryZone).not.toBeNull()
    expect(result.evaluation.stopReference).not.toBeNull()
  })

  it('aggregates diagnostics over the full history', () => {
    const diagnostics = demoDiagnostics('bullish-qml-reversal')
    expect(diagnostics.totalEvaluations).toBe(diagnostics.byStatus.WATCHING +
      diagnostics.byStatus.WAITING_RETEST +
      diagnostics.byStatus.READY +
      diagnostics.byStatus.COMPLETED +
      diagnostics.byStatus.INVALIDATED +
      diagnostics.byStatus.EXPIRED)
    expect(diagnostics.readyCount).toBeGreaterThan(0)
    expect(diagnostics.invariantFailures).toEqual([])
  })
})
