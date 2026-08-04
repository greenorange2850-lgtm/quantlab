import type { ParameterRange, SearchPresetId } from './types.js'

export interface SearchPresetDefinition {
  id: SearchPresetId
  label: string
  description: string
  parameterRanges: ParameterRange[]
}

const conservative: ParameterRange[] = [
  { name: 'fastPeriod', min: 12, max: 28, step: 1 },
  { name: 'slowPeriod', min: 40, max: 100, step: 2 },
  { name: 'rsiPeriod', min: 10, max: 21, step: 1 },
]

const balanced: ParameterRange[] = [
  { name: 'fastPeriod', min: 5, max: 30, step: 1 },
  { name: 'slowPeriod', min: 20, max: 100, step: 1 },
  { name: 'rsiPeriod', min: 7, max: 21, step: 1 },
]

const aggressive: ParameterRange[] = [
  { name: 'fastPeriod', min: 3, max: 20, step: 1 },
  { name: 'slowPeriod', min: 15, max: 60, step: 1 },
  { name: 'rsiPeriod', min: 5, max: 18, step: 1 },
]

export const SEARCH_PRESETS: SearchPresetDefinition[] = [
  {
    id: 'conservative',
    label: 'Conservative',
    description:
      'Slower EMA ranges and lower trade-frequency target. Configures ranges only — no performance guarantee.',
    parameterRanges: conservative,
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description:
      'Medium EMA ranges with balanced frequency/risk. Configures ranges only — no performance guarantee.',
    parameterRanges: balanced,
  },
  {
    id: 'aggressive',
    label: 'Aggressive',
    description:
      'Faster EMA ranges and higher trade-frequency potential. Configures ranges only — no performance guarantee.',
    parameterRanges: aggressive,
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Manual parameter ranges (expert controls).',
    parameterRanges: balanced,
  },
]

export function getSearchPreset(id: SearchPresetId): SearchPresetDefinition {
  return SEARCH_PRESETS.find((p) => p.id === id) ?? SEARCH_PRESETS[3]!
}
