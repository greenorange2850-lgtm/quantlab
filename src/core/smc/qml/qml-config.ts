import type {
  QmlConfirmationMode,
  QmlInvalidationMode,
  QmlRetestMode,
  QmlStructureScope,
  QmlZoneMode,
} from './qml-types'

/** QuantLab Quasimodo Level detector configuration. */
export interface QmlConfig {
  /** Master switch — default false (Experimental). */
  enabled: boolean
  experimental: boolean
  zoneMode: QmlZoneMode
  retestMode: QmlRetestMode
  confirmationMode: QmlConfirmationMode
  invalidationMode: QmlInvalidationMode
  /** Max candles after zone creation without retest before EXPIRED. 0 = disabled. */
  expirationCandles: number
  structureScope: QmlStructureScope
  /** Prefer linked active Order Block as zone when overlap exists. */
  preferLinkedOrderBlock: boolean
  /** Minimum prior Dow trend strength (0–100) to accept CANDIDATE. */
  minimumPriorTrendStrength: number
  /** Deep retrace threshold as fraction of zone height (0–1). */
  deepRetraceFraction: number
}

export const DEFAULT_QML_CONFIG: QmlConfig = {
  enabled: false,
  experimental: true,
  zoneMode: 'OPEN_TO_EXTREME',
  retestMode: 'TOUCH',
  confirmationMode: 'BALANCED',
  invalidationMode: 'CLOSE_BEYOND_ZONE',
  expirationCandles: 0,
  structureScope: 'BOTH',
  preferLinkedOrderBlock: false,
  minimumPriorTrendStrength: 20,
  deepRetraceFraction: 0.7,
}

export function cloneQmlConfig(config: QmlConfig = DEFAULT_QML_CONFIG): QmlConfig {
  return { ...config }
}

export function resolveQmlConfig(partial?: Partial<QmlConfig> | null): QmlConfig {
  const base = cloneQmlConfig()
  if (!partial) return base
  return {
    enabled: partial.enabled ?? base.enabled,
    experimental: partial.experimental ?? base.experimental,
    zoneMode: partial.zoneMode ?? base.zoneMode,
    retestMode: partial.retestMode ?? base.retestMode,
    confirmationMode: partial.confirmationMode ?? base.confirmationMode,
    invalidationMode: partial.invalidationMode ?? base.invalidationMode,
    expirationCandles: clampInt(partial.expirationCandles ?? base.expirationCandles, 0, 500),
    structureScope: partial.structureScope ?? base.structureScope,
    preferLinkedOrderBlock: partial.preferLinkedOrderBlock ?? base.preferLinkedOrderBlock,
    minimumPriorTrendStrength: clampInt(
      partial.minimumPriorTrendStrength ?? base.minimumPriorTrendStrength,
      0,
      100,
    ),
    deepRetraceFraction: clampNumber(
      partial.deepRetraceFraction ?? base.deepRetraceFraction,
      0.1,
      1,
    ),
  }
}

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.round(value)))
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}
