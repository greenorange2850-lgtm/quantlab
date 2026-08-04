import { useCallback, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import { SMC_LAB_TABS, type SmcLabTabId } from './tabs'

export interface SmcLabWorkspaceTabsProps {
  activeTab: SmcLabTabId
  onChange: (tab: SmcLabTabId) => void
  className?: string
}

/** Resolve next tab id for arrow / Home / End keyboard navigation. */
export function nextSmcLabTabFromKey(
  activeTab: SmcLabTabId,
  key: string,
): SmcLabTabId | null {
  const ids = SMC_LAB_TABS.map((t) => t.id)
  const index = ids.indexOf(activeTab)
  if (index < 0) return null
  if (key === 'ArrowRight' || key === 'ArrowDown') {
    return ids[(index + 1) % ids.length]!
  }
  if (key === 'ArrowLeft' || key === 'ArrowUp') {
    return ids[(index - 1 + ids.length) % ids.length]!
  }
  if (key === 'Home') return ids[0]!
  if (key === 'End') return ids[ids.length - 1]!
  return null
}

/**
 * Sticky horizontal tab bar for the SMC Lab workspace.
 * Scrolls on narrow viewports; wraps in an `md:flex` rail-friendly shell for desktop layouts.
 */
export function SmcLabWorkspaceTabs({
  activeTab,
  onChange,
  className,
}: SmcLabWorkspaceTabsProps) {
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const next = nextSmcLabTabFromKey(activeTab, event.key)
      if (!next) return
      event.preventDefault()
      onChange(next)
      // Move focus to the newly selected tab button.
      requestAnimationFrame(() => {
        document.getElementById(`smc-lab-tab-${next}`)?.focus()
      })
    },
    [activeTab, onChange],
  )

  return (
    <div
      className={cn(
        'sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80',
        className,
      )}
    >
      <div className="md:flex md:items-stretch">
        <div
          role="tablist"
          aria-label="SMC Lab workspace"
          className="-mx-1 flex min-w-0 gap-1 overflow-x-auto px-1 py-1.5"
          onKeyDown={onKeyDown}
        >
          {SMC_LAB_TABS.map((tab) => {
            const selected = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`smc-lab-tab-${tab.id}`}
                aria-selected={selected}
                aria-controls={`smc-lab-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                title={tab.description}
                className={cn(
                  'min-h-11 shrink-0 rounded-lg border px-3 text-sm font-medium transition-colors',
                  selected
                    ? 'border-accent/40 bg-accent/10 text-foreground'
                    : 'border-transparent text-muted-foreground hover:bg-white/[0.04] hover:text-foreground',
                )}
                onClick={() => onChange(tab.id)}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
