import { describe, expect, it } from 'vitest'
import { defaultBacktestPipelineParams } from '@/core/dashboard'
import {
  partializeAppState,
  partializeBacktestState,
} from '../persistence'

describe('store persistence partializers', () => {
  it('keeps only UI/session preferences from the app store', () => {
    expect(
      partializeAppState({
        sidebarCollapsed: true,
        activeStrategyId: 'str-1',
        connectionStatus: 'connected',
      }),
    ).toEqual({
      sidebarCollapsed: true,
      activeStrategyId: 'str-1',
    })
  })

  it('keeps only lastParams from the backtest store', () => {
    const lastParams = {
      ...defaultBacktestPipelineParams,
      symbol: 'ETHUSDT',
      limit: 250,
    }

    expect(
      partializeBacktestState({
        lastParams,
      }),
    ).toEqual({ lastParams })
  })

  it('does not include server-owned or derived keys in the backtest partial', () => {
    const partial = partializeBacktestState({
      lastParams: defaultBacktestPipelineParams,
    })

    expect(Object.keys(partial)).toEqual(['lastParams'])
    expect(partial).not.toHaveProperty('dashboard')
    expect(partial).not.toHaveProperty('report')
    expect(partial).not.toHaveProperty('recentBacktests')
    expect(partial).not.toHaveProperty('isRunning')
    expect(partial).not.toHaveProperty('error')
  })
})
