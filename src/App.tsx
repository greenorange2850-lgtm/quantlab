import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { MainLayout } from '@/layouts/MainLayout'
import { DashboardPage } from '@/pages/DashboardPage'
import { MarketExplorerPage } from '@/pages/MarketExplorerPage'
import { StrategyLabPage } from '@/pages/StrategyLabPage'
import { BacktestLabPage } from '@/pages/BacktestLabPage'
import { OptimizerPage } from '@/pages/OptimizerPage'
import { ResearchAnalysisPage } from '@/features/research-analysis'
import { StrategyComparePage } from '@/features/strategy-compare'
import { ResearchSessionsPage } from '@/features/research-sessions'
import { PlaceholderPage } from '@/pages/PlaceholderPage'

const placeholders = [
  {
    path: '/trade-replay',
    title: 'Trade Replay',
    description: 'Step-through trade replay is planned for a future release.',
  },
  {
    path: '/reports',
    title: 'Reports',
    description: 'Exportable performance reports are planned for a future release.',
  },
  {
    path: '/settings',
    title: 'Settings',
    description: 'Platform configuration, data sources and preferences.',
  },
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
          <Route path="/optimizer" element={<OptimizerPage />} />
          <Route path="/research-analysis" element={<ResearchAnalysisPage />} />
          <Route path="/strategy-compare" element={<StrategyComparePage />} />
          <Route path="/research-sessions" element={<ResearchSessionsPage />} />
          <Route path="/ai-analysis" element={<Navigate to="/research-analysis" replace />} />
          <Route path="/knowledge-base" element={<Navigate to="/research-sessions" replace />} />
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
