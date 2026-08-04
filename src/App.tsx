import { BrowserRouter, Routes, Route, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { MainLayout } from '@/layouts/MainLayout'
import { DashboardPage } from '@/pages/DashboardPage'
import { MarketExplorerPage } from '@/pages/MarketExplorerPage'
import { DatasetLibraryPage } from '@/pages/DatasetLibraryPage'
import { StrategyLabPage } from '@/pages/StrategyLabPage'
import { BacktestLabPage } from '@/pages/BacktestLabPage'
import { BacktestReplayPage } from '@/pages/BacktestReplayPage'
import { OptimizerPage } from '@/pages/OptimizerPage'
import { StrategyComparePage } from '@/features/strategy-compare'
import { StrategyLibraryPage } from '@/features/strategy-library'
import { StrategyWorkspacePage } from '@/features/strategy-workspace'
import { PlaceholderPage } from '@/pages/PlaceholderPage'

const placeholders = [
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

/** Legacy Research Analysis → Strategy workspace (AI Analysis tab). */
function LegacyResearchAnalysisRedirect() {
  const [params] = useSearchParams()
  const sessionId = params.get('session')
  if (sessionId) {
    return <Navigate to={`/strategies/${sessionId}?tab=ai`} replace />
  }
  return <Navigate to="/strategies" replace />
}

/** Legacy Research Sessions list → Strategy Library. */
function LegacySessionsRedirect() {
  return <Navigate to="/strategies" replace />
}

/** Legacy session deep-link without /strategies prefix. */
function LegacySessionDetailRedirect() {
  const { sessionId } = useParams<{ sessionId: string }>()
  if (!sessionId) return <Navigate to="/strategies" replace />
  return <Navigate to={`/strategies/${sessionId}`} replace />
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dataset-library" element={<DatasetLibraryPage />} />
          <Route path="/market-explorer" element={<MarketExplorerPage />} />
          <Route path="/strategy-lab" element={<StrategyLabPage />} />
          <Route path="/backtest-lab" element={<BacktestLabPage />} />
          <Route path="/backtest-replay" element={<BacktestReplayPage />} />
          <Route path="/trade-replay" element={<Navigate to="/backtest-replay" replace />} />
          <Route path="/optimizer" element={<OptimizerPage />} />
          <Route path="/new-research" element={<Navigate to="/optimizer" replace />} />
          <Route path="/strategies" element={<StrategyLibraryPage />} />
          <Route path="/strategies/:strategyId" element={<StrategyWorkspacePage />} />
          <Route path="/strategy-compare" element={<StrategyComparePage />} />
          {/* Legacy redirects — Research Sessions are an implementation detail. */}
          <Route path="/research-analysis" element={<LegacyResearchAnalysisRedirect />} />
          <Route path="/research-sessions" element={<LegacySessionsRedirect />} />
          <Route path="/research-sessions/:sessionId" element={<LegacySessionDetailRedirect />} />
          <Route path="/ai-analysis" element={<LegacyResearchAnalysisRedirect />} />
          <Route path="/knowledge-base" element={<Navigate to="/strategies" replace />} />
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
