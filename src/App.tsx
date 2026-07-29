import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { MainLayout } from '@/layouts/MainLayout'
import { DashboardPage } from '@/pages/DashboardPage'
import { MarketExplorerPage } from '@/pages/MarketExplorerPage'
import { StrategyLabPage } from '@/pages/StrategyLabPage'
import { BacktestLabPage } from '@/pages/BacktestLabPage'
import { TradeReplayPage } from '@/pages/TradeReplayPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { PlaceholderPage } from '@/pages/PlaceholderPage'

const placeholders = [
  { path: '/ai-analysis', title: 'AI Analysis', description: 'AI-powered strategy weakness detection and measurable improvement recommendations.' },
  { path: '/knowledge-base', title: 'Knowledge Base', description: 'Accumulated research insights from every completed backtest.' },
  { path: '/optimizer', title: 'Optimizer', description: 'Parameter optimization and walk-forward analysis engine.' },
  { path: '/settings', title: 'Settings', description: 'Platform configuration, data sources and preferences.' },
] as const

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/market-explorer" element={<MarketExplorerPage />} />
          <Route path="/strategy-lab" element={<StrategyLabPage />} />
          <Route path="/backtest-lab" element={<BacktestLabPage />} />
          <Route path="/trade-replay" element={<TradeReplayPage />} />
          <Route path="/reports" element={<ReportsPage />} />
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
