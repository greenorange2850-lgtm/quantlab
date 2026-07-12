import { useBacktestStore } from '@/stores/backtest.store'

export const queryKeys = {
  dashboard: ['dashboard'] as const,
  strategies: ['strategies'] as const,
  strategy: (id: string) => ['strategies', id] as const,
  backtests: ['backtests'] as const,
  symbols: ['symbols'] as const,
  knowledge: ['knowledge'] as const,
  health: ['health'] as const,
}

export function useDashboard() {
  const dashboard = useBacktestStore((state) => state.dashboard)
  const isRunning = useBacktestStore((state) => state.isRunning)

  return {
    data: dashboard,
    isLoading: isRunning,
    isError: false,
  }
}

export function useHealth() {
  return {
    data: { status: 'ok' },
    isLoading: false,
    isError: false,
  }
}
