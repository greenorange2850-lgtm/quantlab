import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MainLayout } from '@/layouts/MainLayout'
import { DashboardPage } from '@/pages/DashboardPage'
import { MarketExplorerPage } from '@/pages/MarketExplorerPage'
import { StrategyLabPage } from '@/pages/StrategyLabPage'
import { BacktestLabPage } from '@/pages/BacktestLabPage'
import { TradeReplayPage } from '@/pages/TradeReplayPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { OptimizerPage } from '@/pages/OptimizerPage'
import { ResearchAnalysisPage } from '@/features/research-analysis'
import { PlaceholderPage } from '@/pages/PlaceholderPage'

const placeholders = [
  { path: '/knowledge-base', title: 'Knowledge Base', description: 'Accumulated research insights from every completed backtest.' },
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
          <Route path="/optimizer" element={<OptimizerPage />} />
          <Route path="/research-analysis" element={<ResearchAnalysisPage />} />
          <Route path="/ai-analysis" element={<Navigate to="/research-analysis" replace />} />
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
