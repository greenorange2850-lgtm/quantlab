import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopNav } from './TopNav'

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

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="ml-[240px]">
        <TopNav title={title} />
        <main className="p-6 max-w-[1440px] mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
