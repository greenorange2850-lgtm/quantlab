import {
  cloneSmcDetectorConfig,
  DEFAULT_SMC_DETECTOR_CONFIG,
} from './defaults'
import type { SmcDetectionResult, SmcDetectorConfig } from './types'

export type SmcProfileId =
  | 'quantlab-default'
  | 'custom'
  | 'ict-inspired'
  | 'swing-structure'
  | 'internal-external-structure'

export interface SmcDetectionProfile {
  id: SmcProfileId | string
  name: string
  version: string
  description: string
  assumptions: string[]
  sourceNotes?: string[]
  limitations: string[]
  config: SmcDetectorConfig
  builtin: boolean
}

function withConfig(
  base: SmcDetectorConfig,
  patch: (cfg: SmcDetectorConfig) => void,
): SmcDetectorConfig {
  const next = cloneSmcDetectorConfig(base)
  patch(next)
  return next
}

export const QUANTLAB_DEFAULT_PROFILE: SmcDetectionProfile = {
  id: 'quantlab-default',
  name: 'QuantLab Default',
  version: '2.0.0',
  description:
    'Baseline QuantLab SMC visual detector: close-confirmed BOS/CHoCH, confirmed pivots, optional displacement, three-candle FVG, wick sweep with close reclaim, Order Block linked to break + displacement.',
  assumptions: [
    'Breaks require candle close beyond the swing level (wick-only ignored).',
    'Swings are confirmed only after pivotRight closed bars.',
    'First qualifying structural break while undetermined establishes provisional bias as BOS.',
    'CHoCH is the first opposing break after an established bias.',
    'Displacement uses ATR and body/range thresholds; not every large candle qualifies.',
    'FVG uses a simple three-candle gap; middle-candle displacement is optional.',
    'Liquidity sweeps require wick penetration plus close reclaim.',
    'Order Blocks require a linked BOS/CHoCH and (by default) displacement.',
  ],
  sourceNotes: [
    'QuantLab Default is an internal laboratory profile, not a named-methodology implementation.',
  ],
  limitations: [
    'Profiles configure rules only; they do not guarantee correctness or trading performance.',
    'No trades, entries, exits, or profitability claims are produced.',
    'Visual verification only — isolated from Strategy/Optimizer/Backtest.',
  ],
  config: cloneSmcDetectorConfig(DEFAULT_SMC_DETECTOR_CONFIG),
  builtin: true,
}

export const ICT_INSPIRED_PROFILE: SmcDetectionProfile = {
  id: 'ict-inspired',
  name: 'ICT-inspired',
  version: '2.0.0',
  description:
    'Interpretation emphasizing liquidity sweeps, displacement-backed structural shifts, FVG association, and external structure preference. Not an official or complete ICT implementation.',
  assumptions: [
    'External swings are preferred for structural breaks.',
    'Stronger structural shifts prefer displacement confirmation for CHoCH.',
    'Order Blocks require displacement; FVG association is enabled.',
    'Liquidity sweeps are emphasized with stricter penetration defaults.',
  ],
  sourceNotes: [
    'Labeled ICT-inspired as an interpretation only.',
    'This repository does not contain a documented primary source defining exact proprietary ICT rules.',
    'Do not treat this profile as “ICT official” or a complete methodology.',
  ],
  limitations: [
    'Not verified against any official ICT curriculum or proprietary rule set.',
    'Rule parameters are laboratory heuristics for visual comparison.',
    'Profiles do not guarantee correctness or performance.',
  ],
  config: withConfig(DEFAULT_SMC_DETECTOR_CONFIG, (cfg) => {
    cfg.structure.enabled = true
    cfg.structure.internalPivotLeft = 2
    cfg.structure.internalPivotRight = 2
    cfg.structure.externalPivotLeft = 10
    cfg.structure.externalPivotRight = 10
    cfg.structure.minimumExternalProminencePercent = 0.25
    cfg.structure.minimumExternalBarsApart = 14
    cfg.bos.preferExternalSwings = true
    cfg.bos.structureScope = 'EXTERNAL'
    cfg.choch.enabled = true
    cfg.choch.preferExternalSwings = true
    cfg.choch.structureScope = 'EXTERNAL'
    cfg.choch.requireDisplacement = true
    cfg.displacement.enabled = true
    cfg.displacement.minimumBodyAtrMultiple = 1.4
    cfg.displacement.minimumBodyToRangeRatio = 0.6
    cfg.displacement.requireStructureBreak = false
    cfg.displacement.requireFvgCreation = false
    cfg.fvg.enabled = true
    cfg.fvg.requireDisplacementMiddleCandle = false
    cfg.fvg.minimumGapPercent = 0.03
    cfg.equalLevels.enabled = true
    cfg.equalLevels.useExternalSwings = true
    cfg.equalLevels.useInternalSwings = false
    cfg.liquiditySweep.enabled = true
    cfg.liquiditySweep.structureScope = 'EXTERNAL'
    cfg.liquiditySweep.minimumPenetrationPercent = 0.03
    cfg.liquiditySweep.requireDisplacementAfterSweep = false
    cfg.orderBlock.enabled = true
    cfg.orderBlock.requireDisplacement = true
    cfg.orderBlock.requireFvg = false
    cfg.orderBlock.sourceBreak = 'BOTH'
    cfg.orderBlock.zoneMode = 'BODY'
  }),
  builtin: true,
}

export const SWING_STRUCTURE_PROFILE: SmcDetectionProfile = {
  id: 'swing-structure',
  name: 'Swing Structure',
  version: '2.0.0',
  description:
    'BOS/CHoCH based primarily on confirmed swing sequence with optional displacement and simpler Order Block rules.',
  assumptions: [
    'Confirmed swing sequence drives structure breaks.',
    'Internal/external classification is exposed but not required for breaks.',
    'Displacement is optional for Order Blocks.',
  ],
  sourceNotes: ['QuantLab laboratory profile for swing-centric structure analysis.'],
  limitations: [
    'Simpler Order Block rules may over-select opposite candles relative to stricter profiles.',
    'Not a trading system.',
  ],
  config: withConfig(DEFAULT_SMC_DETECTOR_CONFIG, (cfg) => {
    cfg.structure.enabled = true
    cfg.choch.enabled = true
    cfg.choch.requireDisplacement = false
    cfg.displacement.enabled = true
    cfg.displacement.requireStructureBreak = false
    cfg.fvg.enabled = true
    cfg.equalLevels.enabled = true
    cfg.liquiditySweep.enabled = true
    cfg.orderBlock.enabled = true
    cfg.orderBlock.requireDisplacement = false
    cfg.orderBlock.requireFvg = false
    cfg.orderBlock.sourceBreak = 'BOTH'
    cfg.orderBlock.zoneMode = 'FULL_CANDLE'
  }),
  builtin: true,
}

export const INTERNAL_EXTERNAL_PROFILE: SmcDetectionProfile = {
  id: 'internal-external-structure',
  name: 'Internal / External Structure',
  version: '2.0.0',
  description:
    'Prioritizes separate internal and external swing layers with structural scope on break events.',
  assumptions: [
    'Internal pivots use a more sensitive window.',
    'External pivots use a less sensitive window plus prominence / spacing filters.',
    'BOS and CHoCH carry structural scope in event metadata.',
  ],
  sourceNotes: ['QuantLab laboratory profile for dual-layer structure visualization.'],
  limitations: [
    'Dual-layer detection increases marker density; use Structure density preset.',
    'Classification criteria are deterministic laboratory heuristics.',
  ],
  config: withConfig(DEFAULT_SMC_DETECTOR_CONFIG, (cfg) => {
    cfg.structure.enabled = true
    cfg.structure.internalPivotLeft = 2
    cfg.structure.internalPivotRight = 2
    cfg.structure.externalPivotLeft = 9
    cfg.structure.externalPivotRight = 9
    cfg.structure.minimumExternalProminencePercent = 0.2
    cfg.structure.minimumExternalBarsApart = 12
    cfg.bos.structureScope = 'BOTH'
    cfg.choch.structureScope = 'BOTH'
    cfg.choch.enabled = true
    cfg.equalLevels.useInternalSwings = true
    cfg.equalLevels.useExternalSwings = true
    cfg.liquiditySweep.structureScope = 'BOTH'
  }),
  builtin: true,
}

export const CUSTOM_PROFILE_TEMPLATE: SmcDetectionProfile = {
  id: 'custom',
  name: 'Custom',
  version: '2.0.0',
  description: 'User-editable profile exposing all detector settings.',
  assumptions: ['User is responsible for validating custom rule combinations.'],
  sourceNotes: ['Starts from QuantLab Default; all settings are editable.'],
  limitations: [
    'Custom configs may disable dependencies and block dependent modules.',
    'Historical reviews for prior fingerprints remain separate.',
  ],
  config: cloneSmcDetectorConfig(DEFAULT_SMC_DETECTOR_CONFIG),
  builtin: true,
}

export const BUILTIN_SMC_PROFILES: readonly SmcDetectionProfile[] = [
  QUANTLAB_DEFAULT_PROFILE,
  ICT_INSPIRED_PROFILE,
  SWING_STRUCTURE_PROFILE,
  INTERNAL_EXTERNAL_PROFILE,
  CUSTOM_PROFILE_TEMPLATE,
]

export function getBuiltinSmcProfile(id: string): SmcDetectionProfile | null {
  return BUILTIN_SMC_PROFILES.find((p) => p.id === id) ?? null
}

export function listBuiltinSmcProfiles(): SmcDetectionProfile[] {
  return BUILTIN_SMC_PROFILES.map((p) => ({
    ...p,
    config: cloneSmcDetectorConfig(p.config),
  }))
}

/** Configuration presets (apply-ready copies). */
export interface SmcConfigPreset {
  id: string
  name: string
  profileId: SmcProfileId | string
  description: string
  builtin: boolean
  config: SmcDetectorConfig
}

export const BUILTIN_SMC_PRESETS: readonly SmcConfigPreset[] = [
  {
    id: 'preset-quantlab-default',
    name: 'QuantLab Default',
    profileId: 'quantlab-default',
    description: 'Baseline Phase 2 QuantLab rules.',
    builtin: true,
    config: cloneSmcDetectorConfig(QUANTLAB_DEFAULT_PROFILE.config),
  },
  {
    id: 'preset-sensitive',
    name: 'Sensitive',
    profileId: 'custom',
    description: 'Tighter pivots and lower thresholds for denser events.',
    builtin: true,
    config: withConfig(DEFAULT_SMC_DETECTOR_CONFIG, (cfg) => {
      cfg.swing.pivotLeft = 3
      cfg.swing.pivotRight = 3
      cfg.structure.internalPivotLeft = 2
      cfg.structure.internalPivotRight = 2
      cfg.structure.externalPivotLeft = 5
      cfg.structure.externalPivotRight = 5
      cfg.displacement.minimumBodyAtrMultiple = 1.0
      cfg.fvg.minimumGapPercent = 0.01
      cfg.liquiditySweep.minimumPenetrationPercent = 0.01
    }),
  },
  {
    id: 'preset-balanced',
    name: 'Balanced',
    profileId: 'quantlab-default',
    description: 'Balanced thresholds around QuantLab Default.',
    builtin: true,
    config: cloneSmcDetectorConfig(DEFAULT_SMC_DETECTOR_CONFIG),
  },
  {
    id: 'preset-conservative',
    name: 'Conservative',
    profileId: 'custom',
    description: 'Wider pivots and stricter displacement / FVG / sweep thresholds.',
    builtin: true,
    config: withConfig(DEFAULT_SMC_DETECTOR_CONFIG, (cfg) => {
      cfg.swing.pivotLeft = 8
      cfg.swing.pivotRight = 8
      cfg.structure.externalPivotLeft = 12
      cfg.structure.externalPivotRight = 12
      cfg.structure.minimumExternalProminencePercent = 0.35
      cfg.displacement.minimumBodyAtrMultiple = 1.6
      cfg.fvg.minimumGapPercent = 0.05
      cfg.liquiditySweep.minimumPenetrationPercent = 0.05
      cfg.orderBlock.requireDisplacement = true
      cfg.orderBlock.requireFvg = true
    }),
  },
  {
    id: 'preset-ict-inspired',
    name: 'ICT-inspired',
    profileId: 'ict-inspired',
    description: 'Applies the ICT-inspired interpretation profile.',
    builtin: true,
    config: cloneSmcDetectorConfig(ICT_INSPIRED_PROFILE.config),
  },
  {
    id: 'preset-external-focus',
    name: 'External Structure Focus',
    profileId: 'internal-external-structure',
    description: 'Emphasizes external swings and external-scope breaks.',
    builtin: true,
    config: withConfig(INTERNAL_EXTERNAL_PROFILE.config, (cfg) => {
      cfg.bos.preferExternalSwings = true
      cfg.bos.structureScope = 'EXTERNAL'
      cfg.choch.preferExternalSwings = true
      cfg.choch.structureScope = 'EXTERNAL'
      cfg.liquiditySweep.structureScope = 'EXTERNAL'
      cfg.equalLevels.useInternalSwings = false
      cfg.equalLevels.useExternalSwings = true
    }),
  },
  {
    id: 'preset-liquidity-focus',
    name: 'Liquidity Focus',
    profileId: 'ict-inspired',
    description: 'Emphasizes equal levels, sweeps, FVG, and Order Blocks.',
    builtin: true,
    config: withConfig(ICT_INSPIRED_PROFILE.config, (cfg) => {
      cfg.equalLevels.enabled = true
      cfg.liquiditySweep.enabled = true
      cfg.fvg.enabled = true
      cfg.orderBlock.enabled = true
      cfg.liquiditySweep.requireSameCandleRejection = true
    }),
  },
]

export function listBuiltinSmcPresets(): SmcConfigPreset[] {
  return BUILTIN_SMC_PRESETS.map((p) => ({
    ...p,
    config: cloneSmcDetectorConfig(p.config),
  }))
}

export interface SmcProfileCompareCounts {
  confirmedSwings: number
  internalSwings: number
  externalSwings: number
  bullishBos: number
  bearishBos: number
  bullishChoch: number
  bearishChoch: number
  displacementEvents: number
  bullishFvg: number
  bearishFvg: number
  liquiditySweeps: number
  orderBlocks: number
  reviewedCorrect: number
  reviewedWrong: number
  reviewedAccuracy: number | null
}

export function countProfileEvents(
  result: SmcDetectionResult,
  review?: { correct: number; wrong: number },
): SmcProfileCompareCounts {
  const decisive = (review?.correct ?? 0) + (review?.wrong ?? 0)
  return {
    confirmedSwings: result.swings.length,
    internalSwings: result.classifiedSwings.filter((s) => s.classification === 'INTERNAL')
      .length,
    externalSwings: result.classifiedSwings.filter((s) => s.classification === 'EXTERNAL')
      .length,
    bullishBos: result.bosEvents.filter((e) => e.kind === 'BULLISH_BOS').length,
    bearishBos: result.bosEvents.filter((e) => e.kind === 'BEARISH_BOS').length,
    bullishChoch: result.chochEvents.filter((e) => e.kind === 'BULLISH_CHOCH').length,
    bearishChoch: result.chochEvents.filter((e) => e.kind === 'BEARISH_CHOCH').length,
    displacementEvents: result.displacementEvents.filter(
      (e) => e.kind === 'BULLISH_DISPLACEMENT' || e.kind === 'BEARISH_DISPLACEMENT',
    ).length,
    bullishFvg: result.fvgEvents.filter((e) => e.kind === 'BULLISH_FVG_CREATED').length,
    bearishFvg: result.fvgEvents.filter((e) => e.kind === 'BEARISH_FVG_CREATED').length,
    liquiditySweeps: result.liquiditySweepEvents.length,
    orderBlocks: result.orderBlockEvents.filter(
      (e) =>
        e.kind === 'BULLISH_ORDER_BLOCK_CREATED' || e.kind === 'BEARISH_ORDER_BLOCK_CREATED',
    ).length,
    reviewedCorrect: review?.correct ?? 0,
    reviewedWrong: review?.wrong ?? 0,
    reviewedAccuracy: decisive > 0 ? (review!.correct / decisive) : null,
  }
}

export function describeCandleEventDifference(input: {
  profileAName: string
  profileBName: string
  eventsA: string[]
  eventsB: string[]
  reason?: string
}): string {
  const a = input.eventsA.length ? input.eventsA.join(', ') : 'No event'
  const b = input.eventsB.length ? input.eventsB.join(', ') : 'No event'
  const lines = [
    `${input.profileAName}:`,
    a,
    '',
    `${input.profileBName}:`,
    b,
  ]
  if (input.reason) {
    lines.push('', 'Reason:', input.reason)
  }
  return lines.join('\n')
}
