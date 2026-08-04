/**
 * Module registration surface for future SMC detectors.
 * Phase 1 ships Market Swings + Break of Structure only.
 * Placeholders must not appear implemented or clickable in the UI.
 */

export type SmcModuleStatus = 'active' | 'planned'

export interface SmcModuleDescriptor {
  id: string
  name: string
  version: string
  status: SmcModuleStatus
  description: string
  /** Config key under SmcDetectorConfig, when active. */
  configKey?: 'swing' | 'bos'
}

export const SMC_MODULES: readonly SmcModuleDescriptor[] = [
  {
    id: 'market-swings',
    name: 'Market Swings',
    version: '1.0.0',
    status: 'active',
    description: 'Confirmed Swing High / Swing Low pivots',
    configKey: 'swing',
  },
  {
    id: 'break-of-structure',
    name: 'Break of Structure',
    version: '1.0.0',
    status: 'active',
    description: 'Bullish / Bearish BOS on candle close',
    configKey: 'bos',
  },
  {
    id: 'choch',
    name: 'CHoCH',
    version: '—',
    status: 'planned',
    description: 'Change of Character — available later',
  },
  {
    id: 'order-block',
    name: 'Order Block',
    version: '—',
    status: 'planned',
    description: 'Order Block zones — available later',
  },
  {
    id: 'fvg',
    name: 'FVG',
    version: '—',
    status: 'planned',
    description: 'Fair Value Gaps — available later',
  },
  {
    id: 'liquidity-sweep',
    name: 'Liquidity Sweep',
    version: '—',
    status: 'planned',
    description: 'Liquidity sweeps — available later',
  },
] as const

export function listActiveSmcModules(): SmcModuleDescriptor[] {
  return SMC_MODULES.filter((module) => module.status === 'active')
}

export function listPlannedSmcModules(): SmcModuleDescriptor[] {
  return SMC_MODULES.filter((module) => module.status === 'planned')
}
