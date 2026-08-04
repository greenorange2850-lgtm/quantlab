import { describe, expect, it } from 'vitest'
import { NAV_ITEMS } from '@trading-os/shared'

describe('v1 released navigation', () => {
  it('marks unimplemented routes as planned and keeps the research workflow live', () => {
    const byId = Object.fromEntries(NAV_ITEMS.map((item) => [item.id, item]))

    expect(byId['strategy-lab']?.path).toBe('/strategy-lab')
    expect(byId['backtest-lab']?.path).toBe('/backtest-lab')
    expect(byId['dataset-library']?.path).toBe('/dataset-library')
    expect(byId['market-explorer']?.path).toBe('/market-explorer')
    expect(byId.optimizer?.path).toBe('/optimizer')
    expect(byId['research-analysis']?.path).toBe('/research-analysis')
    expect(byId['strategy-compare']?.path).toBe('/strategy-compare')
    expect(byId['research-sessions']?.path).toBe('/research-sessions')

    expect(byId['trade-replay'] && 'planned' in byId['trade-replay'] && byId['trade-replay'].planned).toBe(
      true,
    )
    expect(byId.reports && 'planned' in byId.reports && byId.reports.planned).toBe(true)
    expect(byId.settings && 'planned' in byId.settings && byId.settings.planned).toBe(true)

    for (const id of [
      'strategy-lab',
      'dataset-library',
      'optimizer',
      'research-analysis',
      'strategy-compare',
      'research-sessions',
    ] as const) {
      expect('planned' in byId[id]! && byId[id]!.planned).toBeFalsy()
    }
  })
})
