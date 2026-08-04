import { useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  DEFAULT_SMC_LAB_TAB,
  buildSmcLabTabSearchParams,
  isSmcLabTab,
  loadStoredSmcLabTab,
  storeSmcLabTab,
  type SmcLabTabId,
} from './tabs'

/**
 * URL-first SMC Lab tab state.
 *
 * Preference order: `?tab=` → localStorage → default `analyze`.
 * Changing tab is a pure UI state update (no detection side effects).
 */
export function useSmcLabTab(): {
  activeTab: SmcLabTabId
  setTab: (tab: SmcLabTabId) => void
} {
  const [searchParams, setSearchParams] = useSearchParams()
  const syncedRef = useRef(false)

  const tabParam = searchParams.get('tab')
  const hasValidUrlTab = isSmcLabTab(tabParam)
  const activeTab: SmcLabTabId = hasValidUrlTab
    ? tabParam
    : (loadStoredSmcLabTab() ?? DEFAULT_SMC_LAB_TAB)

  useEffect(() => {
    if (syncedRef.current) return
    if (hasValidUrlTab) {
      syncedRef.current = true
      return
    }
    syncedRef.current = true
    const next = buildSmcLabTabSearchParams(searchParams, activeTab)
    setSearchParams(next, { replace: true })
  }, [hasValidUrlTab, activeTab, searchParams, setSearchParams])

  const setTab = useCallback(
    (tab: SmcLabTabId) => {
      storeSmcLabTab(tab)
      const next = buildSmcLabTabSearchParams(searchParams, tab)
      setSearchParams(next, { replace: false })
    },
    [searchParams, setSearchParams],
  )

  return { activeTab, setTab }
}
