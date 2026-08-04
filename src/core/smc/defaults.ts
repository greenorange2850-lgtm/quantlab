import type { SmcDetectorConfig } from './types'

export const DEFAULT_SMC_DETECTOR_CONFIG: SmcDetectorConfig = {
  swing: {
    enabled: true,
    pivotLeft: 5,
    pivotRight: 5,
    equalTolerancePercent: 0,
  },
  bos: {
    enabled: true,
    breakMode: 'CLOSE',
    minimumBreakPercent: 0,
    requireLatestConfirmedSwing: true,
    allowRepeatedBreaksOfSameSwing: false,
  },
}

export function cloneSmcDetectorConfig(
  config: SmcDetectorConfig = DEFAULT_SMC_DETECTOR_CONFIG,
): SmcDetectorConfig {
  return {
    swing: { ...config.swing },
    bos: { ...config.bos },
  }
}
