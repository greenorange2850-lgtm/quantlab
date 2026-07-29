import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopNav } from './TopNav'
import { MAIN_CONTENT_OFFSET, MAIN_PADDING, PAGE_SHELL } from './layout-classes'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/strategy-lab': 'Strategy Lab',
  '/backtest-lab': 'Backtest Lab',
  '/market-explorer': 'Market Explorer',
  '/trade-replay': 'Trade Replay',
  '/ai-analysis': 'AI Analysis',
  '/knowledge-base': 'Knowledge Base',
  '/optimizer': 'Optimizer',
  '/reports': 'Reports',
  '/settings': 'Settings',
}

export function MainLayout() {
  const location = useLocation()
  const title = pageTitles[location.pathname] ?? 'Dashboard'
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    setMobileNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!mobileNavOpen) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNavOpen(false)
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [mobileNavOpen])

  return (
    <div className={PAGE_SHELL}>
      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}

      <Sidebar mobileOpen={mobileNavOpen} onNavigate={() => setMobileNavOpen(false)} />

      <div className={MAIN_CONTENT_OFFSET}>
        <TopNav
          title={title}
          onMenuClick={() => setMobileNavOpen(true)}
          menuOpen={mobileNavOpen}
        />
        <main className={MAIN_PADDING}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
