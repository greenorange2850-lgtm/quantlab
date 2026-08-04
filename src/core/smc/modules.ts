/**
 * Module registration surface for SMC detectors.
 * Phase 2 ships the full laboratory module set; each module is independently toggleable.
 */

export type SmcModuleStatus = 'active' | 'planned'

export type SmcModuleConfigKey =
  | 'swing'
  | 'structure'
  | 'bos'
  | 'choch'
  | 'displacement'
  | 'fvg'
  | 'equalLevels'
  | 'liquiditySweep'
  | 'orderBlock'
  | 'qml'

export interface SmcModuleDescriptor {
  id: string
  name: string
  version: string
  status: SmcModuleStatus
  description: string
  /** Config key under SmcDetectorConfig, when active. */
  configKey?: SmcModuleConfigKey
  /** Soft dependency module ids (UI guidance). */
  requires?: string[]
}

export const SMC_MODULES: readonly SmcModuleDescriptor[] = [
  {
    id: 'market-swings',
    name: 'Market Swings',
    version: '2.0.0',
    status: 'active',
    description: 'Confirmed Swing High / Swing Low pivots',
    configKey: 'swing',
  },
  {
    id: 'internal-external-structure',
    name: 'Internal / External Structure',
    version: '2.0.0',
    status: 'active',
    description: 'Classify swings into internal (iSH/iSL) and external (eSH/eSL) layers',
    configKey: 'structure',
    requires: ['market-swings'],
  },
  {
    id: 'dow-theory',
    name: 'Dow Theory',
    version: '1.0.0',
    status: 'active',
    description:
      'HH/HL/LH/LL progression, trend inference, and strength from classified swings (derived layer)',
    requires: ['internal-external-structure'],
  },
  {
    id: 'break-of-structure',
    name: 'Break of Structure',
    version: '2.0.0',
    status: 'active',
    description: 'Continuation BOS on candle close in the active structural direction',
    configKey: 'bos',
    requires: ['market-swings'],
  },
  {
    id: 'choch',
    name: 'CHoCH',
    version: '2.0.0',
    status: 'active',
    description: 'Change of Character / market structure shift (separate from BOS)',
    configKey: 'choch',
    requires: ['market-swings', 'internal-external-structure'],
  },
  {
    id: 'displacement',
    name: 'Displacement',
    version: '2.0.0',
    status: 'active',
    description: 'Impulse candles by ATR / body-range criteria',
    configKey: 'displacement',
  },
  {
    id: 'fvg',
    name: 'Fair Value Gap',
    version: '2.0.0',
    status: 'active',
    description: 'Three-candle fair value gaps with optional mitigation tracking',
    configKey: 'fvg',
  },
  {
    id: 'equal-levels',
    name: 'Equal High / Equal Low',
    version: '2.0.0',
    status: 'active',
    description: 'Equal-level grouping for liquidity analysis (not a trade signal)',
    configKey: 'equalLevels',
  },
  {
    id: 'liquidity-sweep',
    name: 'Liquidity Sweep',
    version: '2.0.0',
    status: 'active',
    description: 'Buy-side / sell-side liquidity sweeps with close reclaim',
    configKey: 'liquiditySweep',
    requires: ['market-swings'],
  },
  {
    id: 'order-block',
    name: 'Order Block',
    version: '2.0.0',
    status: 'active',
    description: 'Order Block zones linked to BOS/CHoCH (+ optional displacement/FVG)',
    configKey: 'orderBlock',
    requires: ['break-of-structure'],
  },
  {
    id: 'qml',
    name: 'Quasimodo Level (QML)',
    version: '1.0.0-experimental',
    status: 'active',
    description:
      'Experimental Quasimodo Level patterns from Dow progression + CHoCH (disabled by default)',
    configKey: 'qml',
    requires: ['choch', 'dow-theory', 'internal-external-structure'],
  },
] as const

export function listActiveSmcModules(): SmcModuleDescriptor[] {
  return SMC_MODULES.filter((module) => module.status === 'active')
}

export function listPlannedSmcModules(): SmcModuleDescriptor[] {
  return SMC_MODULES.filter((module) => module.status === 'planned')
}

/** Progressive detection module order (deterministic). */
export const SMC_DETECTION_MODULE_ORDER = [
  'swings',
  'structure',
  'dowTheory',
  'equalLevels',
  'structureState',
  'bosChoch',
  'displacement',
  'fvg',
  'liquiditySweep',
  'orderBlock',
  'qml',
  'mitigation',
] as const

export type SmcDetectionModuleStep = (typeof SMC_DETECTION_MODULE_ORDER)[number]
