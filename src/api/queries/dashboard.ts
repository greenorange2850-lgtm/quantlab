import { useQuery } from '@tanstack/react-query'
import type { DashboardData } from '@trading-os/shared'
import { api } from '../client.js'
import { dashboardData as mockData } from '@/mock/dashboard'

export const queryKeys = {
  dashboard: ['dashboard'] as const,
  strategies: ['strategies'] as const,
  strategy: (id: string) => ['strategies', id] as const,
  backtests: ['backtests'] as const,
  symbols: ['symbols'] as const,
  knowledge: ['knowledge'] as const,
  health: ['health'] as const,
}

async function fetchDashboard(): Promise<DashboardData> {
  try {
    return await api.get<DashboardData>('/dashboard')
  } catch {
    return mockData
  }
}

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: fetchDashboard,
    staleTime: 30_000,
  })
}

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () => api.get('/health'),
    refetchInterval: 60_000,
    retry: 1,
  })
}
