/** Dow Theory progression labels for successive swing highs/lows. */
export type DowSwingLabel = 'HH' | 'HL' | 'LH' | 'LL'

export type DowTrend =
  | 'Bullish'
  | 'Bearish'
  | 'Pullback'
  | 'Reversal'
  | 'Range'
  | 'Unknown'

export type DowStructurePhase =
  | 'IMPULSE'
  | 'PULLBACK'
  | 'REVERSAL'
  | 'RANGE'
  | 'INSUFFICIENT'

export const SMC_DOW_THEORY_VERSION = '1.0.0'

/** Immutable per-swing Dow metadata — never mutates classified swing objects. */
export interface SmcDowSwingMeta {
  swingId: string
  /** Null when this is the first swing of its high/low series (no prior compare). */
  label: DowSwingLabel | null
  candleIndex: number
  confirmedAtIndex: number
  classification: 'INTERNAL' | 'EXTERNAL'
  kind: 'HIGH' | 'LOW'
  price: number
  /** Reason for the assigned label. */
  reason: string
}

/**
 * Public Dow Theory snapshot shape.
 */
export interface SmcDowTheorySnapshot {
  trend: DowTrend
  /** Trend strength 0–100. */
  strength: number
  structurePhase: DowStructurePhase
  /** swingId → HH/HL/LH/LL (null = seed / unlabeled). */
  swingClassification: Record<string, DowSwingLabel | null>
  latestExternalSwing: SmcDowSwingMeta | null
  latestInternalSwing: SmcDowSwingMeta | null
}

export interface SmcDowTheoryDiagnostics {
  hhCount: number
  hlCount: number
  lhCount: number
  llCount: number
  currentTrend: DowTrend
  trendStrength: number
  structurePhase: DowStructurePhase
}

/** Full derived layer attached to detection results. */
export interface SmcDowTheoryLayer extends SmcDowTheorySnapshot {
  version: string
  visibleThroughIndex: number
  /** Ordered metadata for every knowable classified swing. */
  swings: SmcDowSwingMeta[]
  bySwingId: Record<string, SmcDowSwingMeta>
  diagnostics: SmcDowTheoryDiagnostics
  /** Source swing ids consumed (for replay isolation checks). */
  sourceSwingIds: string[]
}

/** Minimal swing shape consumed by Dow Theory (avoids circular type imports). */
export interface DowTheoryClassifiedSwing {
  id: string
  kind: string
  candleIndex: number
  confirmedAtIndex: number
  classification: 'INTERNAL' | 'EXTERNAL'
  price: number
}
