import { describe, expect, it } from 'vitest'
import { NAV_ITEMS } from '@trading-os/shared'

describe('v1 released navigation', () => {
  it('centers the strategy-first research workflow', () => {
    const byId = Object.fromEntries(NAV_ITEMS.map((item) => [item.id, item]))

    expect(byId.optimizer?.label).toBe('New Research')
    expect(byId.optimizer?.path).toBe('/optimizer')
    expect(byId['strategy-library']?.label).toBe('Strategy Library')
    expect(byId['strategy-library']?.path).toBe('/strategies')

    expect(byId['strategy-lab']?.path).toBe('/strategy-lab')
    expect(byId['backtest-lab']?.path).toBe('/backtest-lab')
    expect(byId['dataset-library']?.path).toBe('/dataset-library')
    expect(byId['market-explorer']?.path).toBe('/market-explorer')
    expect(byId['strategy-compare']?.path).toBe('/strategy-compare')

    // Research Sessions / Research Analysis are no longer primary nav items.
    expect(byId['research-sessions']).toBeUndefined()
    expect(byId['research-analysis']).toBeUndefined()

    expect(byId['trade-replay']?.path).toBe('/backtest-replay')
    expect(byId['trade-replay'] && 'planned' in byId['trade-replay'] && byId['trade-replay'].planned).toBeFalsy()
    expect(byId.reports && 'planned' in byId.reports && byId.reports.planned).toBe(true)
    expect(byId.settings && 'planned' in byId.settings && byId.settings.planned).toBe(true)

    for (const id of [
      'strategy-lab',
      'dataset-library',
      'optimizer',
      'strategy-library',
      'strategy-compare',
    ] as const) {
      expect('planned' in byId[id]! && byId[id]!.planned).toBeFalsy()
    }
  })
})
