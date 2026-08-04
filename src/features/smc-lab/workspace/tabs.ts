export type SmcLabTabId = 'analyze' | 'configure' | 'validate' | 'diagnostics'

export interface SmcLabTabDefinition {
  id: SmcLabTabId
  label: string
  description: string
}

export const SMC_LAB_TABS: ReadonlyArray<SmcLabTabDefinition> = [
  {
    id: 'analyze',
    label: 'Analyze',
    description: 'Chart review, events, and detection results',
  },
  {
    id: 'configure',
    label: 'Configure',
    description: 'Detection profile, modules, and layer settings',
  },
  {
    id: 'validate',
    label: 'Validate',
    description: 'Golden datasets and validation workflows',
  },
  {
    id: 'diagnostics',
    label: 'Diagnostics',
    description: 'Ranking, pipeline, and detector diagnostics',
  },
] as const

export const DEFAULT_SMC_LAB_TAB: SmcLabTabId = 'analyze'

export const SMC_LAB_TAB_STORAGE_KEY = 'quantlab.smc-lab.active-tab.v1'

const TAB_IDS = new Set<string>(SMC_LAB_TABS.map((tab) => tab.id))

export function isSmcLabTab(value: unknown): value is SmcLabTabId {
  return typeof value === 'string' && TAB_IDS.has(value)
}

export function parseSmcLabTab(value: string | null | undefined): SmcLabTabId {
  return isSmcLabTab(value) ? value : DEFAULT_SMC_LAB_TAB
}

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

/** Returns the persisted tab, or null when unset / invalid / unavailable. */
export function loadStoredSmcLabTab(): SmcLabTabId | null {
  if (!canUseStorage()) return null
  try {
    const raw = localStorage.getItem(SMC_LAB_TAB_STORAGE_KEY)
    return isSmcLabTab(raw) ? raw : null
  } catch {
    return null
  }
}

export function storeSmcLabTab(tab: SmcLabTabId): void {
  if (!canUseStorage()) return
  try {
    localStorage.setItem(SMC_LAB_TAB_STORAGE_KEY, tab)
  } catch {
    // Ignore quota / private-mode failures — tab still works via URL.
  }
}

/** Clone search params and set (or replace) the `tab` key. */
export function buildSmcLabTabSearchParams(
  current: URLSearchParams,
  tab: SmcLabTabId,
): URLSearchParams {
  const next = new URLSearchParams(current)
  next.set('tab', tab)
  return next
}
