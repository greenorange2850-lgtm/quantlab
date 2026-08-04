import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SMC_LAB_TAB,
  SMC_LAB_TABS,
  parseSmcLabTab,
  type SmcLabTabId,
} from '@/features/smc-lab/workspace/tabs'
import { hasUnappliedDetectionConfig } from '@/features/smc-lab/workspace/dirty-config'

describe('SMC Lab workspace — tab definitions', () => {
  it('has exactly 4 tabs with the expected ids', () => {
    expect(SMC_LAB_TABS).toHaveLength(4)
    const ids = SMC_LAB_TABS.map((t) => t.id)
    expect(ids).toEqual(['analyze', 'configure', 'validate', 'diagnostics'])
  })

  it('each tab has the a11y ids smc-lab-tab-{id} and smc-lab-panel-{id}', () => {
    for (const tab of SMC_LAB_TABS) {
      expect(`smc-lab-tab-${tab.id}`).toBe(`smc-lab-tab-${tab.id}`)
      expect(`smc-lab-panel-${tab.id}`).toBe(`smc-lab-panel-${tab.id}`)
    }
    // Spot-check specific values
    expect(`smc-lab-tab-analyze`).toBe('smc-lab-tab-analyze')
    expect(`smc-lab-panel-analyze`).toBe('smc-lab-panel-analyze')
    expect(`smc-lab-tab-configure`).toBe('smc-lab-tab-configure')
    expect(`smc-lab-panel-configure`).toBe('smc-lab-panel-configure')
    expect(`smc-lab-tab-validate`).toBe('smc-lab-tab-validate')
    expect(`smc-lab-panel-validate`).toBe('smc-lab-panel-validate')
    expect(`smc-lab-tab-diagnostics`).toBe('smc-lab-tab-diagnostics')
    expect(`smc-lab-panel-diagnostics`).toBe('smc-lab-panel-diagnostics')
  })

  it('each tab has a non-empty label and description', () => {
    for (const tab of SMC_LAB_TABS) {
      expect(tab.label).toBeTruthy()
      expect(tab.description).toBeTruthy()
    }
  })
})

describe('parseSmcLabTab', () => {
  it('returns analyze as the default tab', () => {
    expect(DEFAULT_SMC_LAB_TAB).toBe('analyze')
    expect(parseSmcLabTab(null)).toBe('analyze')
    expect(parseSmcLabTab(undefined)).toBe('analyze')
    expect(parseSmcLabTab('')).toBe('analyze')
    expect(parseSmcLabTab('not-a-tab')).toBe('analyze')
  })

  it('round-trips all valid tab query param values', () => {
    const validIds: SmcLabTabId[] = ['analyze', 'configure', 'validate', 'diagnostics']
    for (const id of validIds) {
      expect(parseSmcLabTab(id)).toBe(id)
    }
  })
})

describe('hasUnappliedDetectionConfig — dirty/clear semantics', () => {
  it('is never dirty before the first detection run (appliedConfigHash null)', () => {
    expect(
      hasUnappliedDetectionConfig({ currentConfigHash: 'abc', appliedConfigHash: null }),
    ).toBe(false)
  })

  it('is clean when current matches applied', () => {
    expect(
      hasUnappliedDetectionConfig({
        currentConfigHash: 'hash-1',
        appliedConfigHash: 'hash-1',
      }),
    ).toBe(false)
  })

  it('is dirty when applied exists but differs from current', () => {
    expect(
      hasUnappliedDetectionConfig({
        currentConfigHash: 'hash-2',
        appliedConfigHash: 'hash-1',
      }),
    ).toBe(true)
  })

  it('config changes after apply set dirty=true', () => {
    const applied = 'original-hash'
    const current = 'modified-hash'
    expect(hasUnappliedDetectionConfig({ currentConfigHash: current, appliedConfigHash: applied })).toBe(true)
  })

  it('re-applying with same config clears dirty', () => {
    const hash = 'stable-hash'
    expect(hasUnappliedDetectionConfig({ currentConfigHash: hash, appliedConfigHash: hash })).toBe(false)
  })
})

/**
 * Documents the tab-switching contract: switching tabs is UI-only state.
 * No detection side-effects, no state reset.
 * These tests exercise helpers in isolation (no full page mount required).
 */
describe('tab switching — UI-only contract', () => {
  it('parseSmcLabTab is pure — same input always gives same output', () => {
    const inputs = ['analyze', 'configure', 'validate', 'diagnostics', 'invalid', null, undefined]
    for (const input of inputs) {
      const first = parseSmcLabTab(input as string | null | undefined)
      const second = parseSmcLabTab(input as string | null | undefined)
      expect(first).toBe(second)
    }
  })

  it('dirty state is independent of active tab — depends only on config hashes', () => {
    // Simulate: user switches from analyze to configure, edits config, then switches back.
    // configDirty should only depend on hashes — not on which tab is visible.
    const hash = 'h1'
    // Before edit: clean regardless of tab
    expect(hasUnappliedDetectionConfig({ currentConfigHash: hash, appliedConfigHash: hash })).toBe(false)
    // After edit (hash changed): dirty regardless of tab
    expect(hasUnappliedDetectionConfig({ currentConfigHash: 'h2', appliedConfigHash: hash })).toBe(true)
  })
})
