import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { MainLayout } from '@/layouts/MainLayout'
import { DashboardPage } from '@/pages/DashboardPage'
import { MarketExplorerPage } from '@/pages/MarketExplorerPage'
import { PlaceholderPage } from '@/pages/PlaceholderPage'

const placeholders = [
  { path: '/strategy-lab', title: 'Strategy Lab', description: 'Create, version and manage trading strategies with full rule and filter configuration.' },
  { path: '/backtest-lab', title: 'Backtest Lab', description: 'Run historical backtests, compare versions and analyze performance metrics.' },
  { path: '/trade-replay', title: 'Trade Replay', description: 'Step through historical trades with chart replay and pattern visualization.' },
  { path: '/ai-analysis', title: 'AI Analysis', description: 'AI-powered strategy weakness detection and measurable improvement recommendations.' },
  { path: '/knowledge-base', title: 'Knowledge Base', description: 'Accumulated research insights from every completed backtest.' },
  { path: '/optimizer', title: 'Optimizer', description: 'Parameter optimization and walk-forward analysis engine.' },
  { path: '/reports', title: 'Reports', description: 'Generate and export institutional-grade performance reports.' },
  { path: '/settings', title: 'Settings', description: 'Platform configuration, data sources and preferences.' },
] as const

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/market-explorer" element={<MarketExplorerPage />} />
          {placeholders.map((p) => (
            <Route
              key={p.path}
              path={p.path}
              element={<PlaceholderPage title={p.title} description={p.description} />}
            />
          ))}
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
