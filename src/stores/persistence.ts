import type { ConnectionStatus } from '@trading-os/shared'
import type { RunBacktestPipelineParams } from '@/core/dashboard'

/**
 * Zustand field classification (dashboard / backtest / app stores).
 *
 * | Field | Class | Persist? | Rationale |
 * |---|---|---|---|
 * | sidebarCollapsed | UI state | yes | Layout preference |
 * | activeStrategyId | Session preference | yes | Last selected strategy |
 * | connectionStatus | Derived / runtime | no | Live connection signal |
 * | lastParams | Session preference | yes | Last Strategy Lab run form |
 * | isRunning | UI state (ephemeral) | no | In-flight flag |
 * | error | UI state (ephemeral) | no | Transient error banner |
 * | report | Session working set | no | Large; rebuilt by next run |
 * | dashboard.* (KPIs, charts, …) | Derived state | no | Computed from report |
 * | dashboard.recentBacktests | Server-owned | no | Hydrated from GET /backtests |
 */

/** App store slice written to localStorage. */
export interface AppPersistedState {
  sidebarCollapsed: boolean
  activeStrategyId: string | null
}

/** Backtest store slice written to localStorage. */
export interface BacktestPersistedState {
  lastParams: RunBacktestPipelineParams
}

export interface AppPersistableFields {
  sidebarCollapsed: boolean
  activeStrategyId: string | null
  connectionStatus: ConnectionStatus
}

export interface BacktestPersistableFields {
  lastParams: RunBacktestPipelineParams
}

export const APP_STORE_PERSIST_NAME = 'quantlab:app'
export const BACKTEST_STORE_PERSIST_NAME = 'quantlab:backtest'
export const STORE_PERSIST_VERSION = 1

/** Keep only UI / session preferences from the app store. */
export function partializeAppState(state: AppPersistableFields): AppPersistedState {
  return {
    sidebarCollapsed: state.sidebarCollapsed,
    activeStrategyId: state.activeStrategyId,
  }
}

/** Keep only session preferences from the backtest store. */
export function partializeBacktestState(
  state: BacktestPersistableFields,
): BacktestPersistedState {
  return {
    lastParams: state.lastParams,
  }
}

/**
 * Storage that works in the browser and in Node (tests / SSR).
 * Avoids throwing when `localStorage` is unavailable.
 */
export function getPersistStorage(): Storage {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage
  }

  const memory = new Map<string, string>()
  return {
    get length() {
      return memory.size
    },
    clear: () => memory.clear(),
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value)
    },
    removeItem: (key: string) => {
      memory.delete(key)
    },
    key: (index: number) => Array.from(memory.keys())[index] ?? null,
  }
}
