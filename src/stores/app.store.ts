import { create } from 'zustand'
import type { ConnectionStatus } from '@trading-os/shared'

interface AppState {
  sidebarCollapsed: boolean
  connectionStatus: ConnectionStatus
  activeStrategyId: string | null
  toggleSidebar: () => void
  setConnectionStatus: (status: ConnectionStatus) => void
  setActiveStrategyId: (id: string | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: false,
  connectionStatus: 'connected',
  activeStrategyId: null,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setActiveStrategyId: (id) => set({ activeStrategyId: id }),
}))
