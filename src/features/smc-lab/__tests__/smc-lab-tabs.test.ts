import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_SMC_LAB_TAB,
  SMC_LAB_TAB_STORAGE_KEY,
  SMC_LAB_TABS,
  buildSmcLabTabSearchParams,
  isSmcLabTab,
  loadStoredSmcLabTab,
  parseSmcLabTab,
  storeSmcLabTab,
} from '@/features/smc-lab/workspace/tabs'
import { hasUnappliedDetectionConfig } from '@/features/smc-lab/workspace/dirty-config'

describe('SMC Lab tabs helpers', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
      clear: () => {
        store.clear()
      },
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      get length() {
        return store.size
      },
    })
  })

  it('exposes the four workspace tabs with analyze as default', () => {
    expect(SMC_LAB_TABS.map((tab) => tab.id)).toEqual([
      'analyze',
      'configure',
      'validate',
      'diagnostics',
    ])
    expect(DEFAULT_SMC_LAB_TAB).toBe('analyze')
    expect(SMC_LAB_TAB_STORAGE_KEY).toBe('quantlab.smc-lab.active-tab.v1')
  })

  it('parses valid tabs and falls back to analyze for invalid values', () => {
    expect(parseSmcLabTab('configure')).toBe('configure')
    expect(parseSmcLabTab('validate')).toBe('validate')
    expect(parseSmcLabTab('diagnostics')).toBe('diagnostics')
    expect(parseSmcLabTab('analyze')).toBe('analyze')
    expect(parseSmcLabTab(null)).toBe('analyze')
    expect(parseSmcLabTab(undefined)).toBe('analyze')
    expect(parseSmcLabTab('')).toBe('analyze')
    expect(parseSmcLabTab('nope')).toBe('analyze')
  })

  it('narrows unknown values with isSmcLabTab', () => {
    expect(isSmcLabTab('analyze')).toBe(true)
    expect(isSmcLabTab('configure')).toBe(true)
    expect(isSmcLabTab('overview')).toBe(false)
    expect(isSmcLabTab(null)).toBe(false)
    expect(isSmcLabTab(12)).toBe(false)
  })

  it('loads and stores the active tab in localStorage', () => {
    expect(loadStoredSmcLabTab()).toBeNull()

    storeSmcLabTab('validate')
    expect(localStorage.getItem(SMC_LAB_TAB_STORAGE_KEY)).toBe('validate')
    expect(loadStoredSmcLabTab()).toBe('validate')

    localStorage.setItem(SMC_LAB_TAB_STORAGE_KEY, 'garbage')
    expect(loadStoredSmcLabTab()).toBeNull()
  })

  it('builds search params without mutating the current instance', () => {
    const current = new URLSearchParams('symbol=BTCUSDT&tab=analyze')
    const next = buildSmcLabTabSearchParams(current, 'configure')

    expect(next.get('tab')).toBe('configure')
    expect(next.get('symbol')).toBe('BTCUSDT')
    expect(current.get('tab')).toBe('analyze')
    expect(next).not.toBe(current)
  })
})

describe('hasUnappliedDetectionConfig', () => {
  it('is false when detection has never been applied', () => {
    expect(
      hasUnappliedDetectionConfig({
        currentConfigHash: 'hash-a',
        appliedConfigHash: null,
      }),
    ).toBe(false)
  })

  it('is false when current matches applied', () => {
    expect(
      hasUnappliedDetectionConfig({
        currentConfigHash: 'hash-a',
        appliedConfigHash: 'hash-a',
      }),
    ).toBe(false)
  })

  it('is true when applied exists and differs from current', () => {
    expect(
      hasUnappliedDetectionConfig({
        currentConfigHash: 'hash-b',
        appliedConfigHash: 'hash-a',
      }),
    ).toBe(true)
  })
})
