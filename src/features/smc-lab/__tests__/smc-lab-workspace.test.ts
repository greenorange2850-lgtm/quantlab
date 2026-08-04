import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SMC_LAB_TAB,
  SMC_LAB_TABS,
  buildSmcLabTabSearchParams,
  parseSmcLabTab,
  type SmcLabTabId,
} from '@/features/smc-lab/workspace/tabs'
import { hasUnappliedDetectionConfig } from '@/features/smc-lab/workspace/dirty-config'
import { nextSmcLabTabFromKey } from '@/features/smc-lab/workspace/SmcLabWorkspaceTabs'

const workspaceRoot = resolve(__dirname, '..')

function readWorkspaceSource(name: string): string {
  return readFileSync(resolve(workspaceRoot, 'workspace', name), 'utf8')
}

describe('SMC Lab workspace — tab definitions', () => {
  it('has exactly 4 tabs with the expected ids', () => {
    expect(SMC_LAB_TABS).toHaveLength(4)
    expect(SMC_LAB_TABS.map((t) => t.id)).toEqual([
      'analyze',
      'configure',
      'validate',
      'diagnostics',
    ])
  })

  it('default tab is Analyze', () => {
    expect(DEFAULT_SMC_LAB_TAB).toBe('analyze')
    expect(parseSmcLabTab(null)).toBe('analyze')
  })

  it('tab query param round-trips via search params builder', () => {
    for (const id of ['analyze', 'configure', 'validate', 'diagnostics'] as SmcLabTabId[]) {
      const params = buildSmcLabTabSearchParams(new URLSearchParams('foo=1'), id)
      expect(params.get('tab')).toBe(id)
      expect(params.get('foo')).toBe('1')
      expect(parseSmcLabTab(params.get('tab'))).toBe(id)
    }
  })
})

describe('hasUnappliedDetectionConfig', () => {
  it('is false before first apply', () => {
    expect(
      hasUnappliedDetectionConfig({ currentConfigHash: 'abc', appliedConfigHash: null }),
    ).toBe(false)
  })

  it('is dirty when hashes differ and clears when re-applied', () => {
    expect(
      hasUnappliedDetectionConfig({
        currentConfigHash: 'hash-2',
        appliedConfigHash: 'hash-1',
      }),
    ).toBe(true)
    expect(
      hasUnappliedDetectionConfig({
        currentConfigHash: 'hash-2',
        appliedConfigHash: 'hash-2',
      }),
    ).toBe(false)
  })

  it('dirty state is independent of active tab', () => {
    expect(
      hasUnappliedDetectionConfig({ currentConfigHash: 'h2', appliedConfigHash: 'h1' }),
    ).toBe(true)
  })
})

describe('keyboard / accessibility tab navigation', () => {
  it('arrow keys cycle tabs without wrapping past contract', () => {
    expect(nextSmcLabTabFromKey('analyze', 'ArrowRight')).toBe('configure')
    expect(nextSmcLabTabFromKey('configure', 'ArrowRight')).toBe('validate')
    expect(nextSmcLabTabFromKey('diagnostics', 'ArrowRight')).toBe('analyze')
    expect(nextSmcLabTabFromKey('analyze', 'ArrowLeft')).toBe('diagnostics')
    expect(nextSmcLabTabFromKey('configure', 'Home')).toBe('analyze')
    expect(nextSmcLabTabFromKey('analyze', 'End')).toBe('diagnostics')
  })

  it('tab buttons and panels use matching a11y ids in source', () => {
    const tabsSource = readWorkspaceSource('SmcLabWorkspaceTabs.tsx')
    expect(tabsSource).toContain('role="tablist"')
    expect(tabsSource).toContain('role="tab"')
    expect(tabsSource).toContain('aria-selected')
    expect(tabsSource).toContain('aria-controls={`smc-lab-panel-${tab.id}`}')
    expect(tabsSource).toContain('id={`smc-lab-tab-${tab.id}`}')
    expect(tabsSource).toContain('tabIndex={selected ? 0 : -1}')
    expect(tabsSource).toContain('onKeyDown')

    const panels: Record<SmcLabTabId, string> = {
      analyze: 'SmcAnalyzeWorkspace.tsx',
      configure: 'SmcConfigureWorkspace.tsx',
      validate: 'SmcValidateWorkspace.tsx',
      diagnostics: 'SmcDiagnosticsWorkspace.tsx',
    }
    for (const tab of SMC_LAB_TABS) {
      const src = readWorkspaceSource(panels[tab.id])
      expect(src).toContain(`id="smc-lab-panel-${tab.id}"`)
      expect(src).toContain('role="tabpanel"')
      expect(src).toContain(`aria-labelledby="smc-lab-tab-${tab.id}"`)
    }
  })
})

describe('workspace control placement (no duplicates / correct tab)', () => {
  it('validation controls only appear in Validate workspace', () => {
    const validate = readWorkspaceSource('SmcValidateWorkspace.tsx')
    const analyze = readWorkspaceSource('SmcAnalyzeWorkspace.tsx')
    const configure = readWorkspaceSource('SmcConfigureWorkspace.tsx')
    const diagnostics = readWorkspaceSource('SmcDiagnosticsWorkspace.tsx')

    expect(validate).toContain('SmcValidationDashboard')
    expect(analyze).not.toContain('SmcValidationDashboard')
    expect(configure).not.toContain('SmcValidationDashboard')
    expect(diagnostics).not.toContain('SmcValidationDashboard')
  })

  it('full MarketSourceFields only in Configure; Analyze stays compact', () => {
    const configure = readWorkspaceSource('SmcConfigureWorkspace.tsx')
    const analyze = readWorkspaceSource('SmcAnalyzeWorkspace.tsx')
    expect(configure).toContain('MarketSourceFields')
    expect(analyze).not.toContain('MarketSourceFields')
    expect(analyze).toContain('SmcAppliedConfigSummary')
    expect(analyze).toContain('SmcQuickViewControls')
  })

  it('developer diagnostics banner only in Diagnostics', () => {
    const diagnostics = readWorkspaceSource('SmcDiagnosticsWorkspace.tsx')
    const analyze = readWorkspaceSource('SmcAnalyzeWorkspace.tsx')
    expect(diagnostics).toContain('Developer diagnostics — not required for normal analysis.')
    expect(analyze).not.toContain('Developer diagnostics — not required for normal analysis.')
  })

  it('MarketSourceFields idPrefix appears once across workspaces', () => {
    const configure = readWorkspaceSource('SmcConfigureWorkspace.tsx')
    const analyze = readWorkspaceSource('SmcAnalyzeWorkspace.tsx')
    const validate = readWorkspaceSource('SmcValidateWorkspace.tsx')
    const diagnostics = readWorkspaceSource('SmcDiagnosticsWorkspace.tsx')
    const all = [configure, analyze, validate, diagnostics].join('\n')
    const matches = all.match(/idPrefix=["']smc-cfg["']/g) ?? []
    expect(matches.length).toBe(1)
    expect(analyze).not.toMatch(/idPrefix=/)
    expect(validate).not.toMatch(/MarketSourceFields/)
  })

  it('page keeps all panels mounted (CSS hidden) so chart/replay state survives tab changes', () => {
    const page = readFileSync(resolve(workspaceRoot, 'SmcLabPage.tsx'), 'utf8')
    expect(page).toContain("activeTab === 'analyze' ? undefined : 'hidden'")
    expect(page).toContain("activeTab === 'configure' ? undefined : 'hidden'")
    expect(page).toContain('setAppliedConfigHash')
    expect(page).toContain('hasUnappliedDetectionConfig')
    // Tab change must not call applyDetection
    expect(page).toMatch(/SmcLabWorkspaceTabs activeTab=\{activeTab\} onChange=\{setTab\}/)
  })
})
