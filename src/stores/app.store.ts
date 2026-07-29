import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { ConnectionStatus } from '@trading-os/shared'
import {
  APP_STORE_PERSIST_NAME,
  STORE_PERSIST_VERSION,
  getPersistStorage,
  partializeAppState,
} from './persistence'

interface AppState {
  /** UI preference — persisted. */
  sidebarCollapsed: boolean
  /** Runtime connection signal — not persisted. */
  connectionStatus: ConnectionStatus
  /** Session preference — persisted. */
  activeStrategyId: string | null
  toggleSidebar: () => void
  setConnectionStatus: (status: ConnectionStatus) => void
  setActiveStrategyId: (id: string | null) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      connectionStatus: 'connected',
      activeStrategyId: null,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setConnectionStatus: (status) => set({ connectionStatus: status }),
      setActiveStrategyId: (id) => set({ activeStrategyId: id }),
    }),
    {
      name: APP_STORE_PERSIST_NAME,
      version: STORE_PERSIST_VERSION,
      storage: createJSONStorage(getPersistStorage),
      partialize: (state): ReturnType<typeof partializeAppState> => partializeAppState(state),
    },
  ),
)
