export type {
  DowSwingLabel,
  DowTrend,
  DowStructurePhase,
  SmcDowSwingMeta,
  SmcDowTheorySnapshot,
  SmcDowTheoryDiagnostics,
  SmcDowTheoryLayer,
  DowTheoryClassifiedSwing,
} from './types'
export { SMC_DOW_THEORY_VERSION } from './types'

export { classifyDowSwingProgression } from './classify-swings'
export { inferDowTrend } from './infer-trend'
export {
  analyzeDowTheory,
  applyDowTheoryLayer,
  emptyDowTheoryLayer,
  toDowTheorySnapshot,
} from './engine'
