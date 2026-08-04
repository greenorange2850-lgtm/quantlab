import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ResearchPersistenceDiagnosticsPanel } from '@/components/dev/ResearchPersistenceDiagnosticsPanel'
import { Sidebar } from './Sidebar'
import { TopNav } from './TopNav'
import {
  DRAWER_BACKDROP,
  MAIN_CONTENT_OFFSET,
  MAIN_PADDING,
  PAGE_SHELL,
} from './layout-classes'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/strategy-lab': 'Strategy Lab',
  '/backtest-lab': 'Backtest Lab',
  '/backtest-replay': 'Backtest Replay',
  '/dataset-library': 'Dataset Library',
  '/market-explorer': 'Market Explorer',
  '/trade-replay': 'Trade Replay',
  '/ai-analysis': 'Strategy',
  '/research-analysis': 'Strategy',
  '/strategy-compare': 'Strategy Compare',
  '/strategies': 'Strategy Library',
  '/research-sessions': 'Strategy Library',
  '/knowledge-base': 'Strategy Library',
  '/optimizer': 'New Research',
  '/new-research': 'New Research',
  '/smc-lab': 'SMC Lab',
  '/reports': 'Reports',
  '/settings': 'Settings',
}

function resolvePageTitle(pathname: string): string {
  if (pathname.startsWith('/strategies/')) return 'Strategy'
  return pageTitles[pathname] ?? 'Dashboard'
}

export function MainLayout() {
  const location = useLocation()
  const title = resolvePageTitle(location.pathname)
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
      <AnimatePresence>
        {mobileNavOpen ? (
          <motion.button
            key="drawer-backdrop"
            type="button"
            aria-label="Close navigation menu"
            className={DRAWER_BACKDROP}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={() => setMobileNavOpen(false)}
          />
        ) : null}
      </AnimatePresence>

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

      <ResearchPersistenceDiagnosticsPanel />
    </div>
  )
}
