import {
  cloneSmcDetectorConfig,
  DEFAULT_SMC_DETECTOR_CONFIG,
  listBuiltinSmcPresets,
  type SmcDetectorConfig,
} from '@/core/smc'
import {
  SMC_LAB_CONFIGS_STORAGE_KEY,
  SMC_LAB_PREFS_STORAGE_KEY,
  type SmcDensityPreset,
  type SmcLabPreferences,
  type SmcSavedLabConfig,
} from './types'

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

export const DEFAULT_SMC_LAYER_TOGGLES: SmcLabPreferences['layerToggles'] = {
  externalSwings: true,
  internalSwings: false,
  bosLabels: true,
  chochLabels: true,
  internalBreaks: false,
  bosLines: false,
  activeFvg: true,
  mitigatedFvg: false,
  activeOrderBlocks: true,
  invalidatedOrderBlocks: false,
  equalLevels: false,
  liquiditySweeps: true,
  displacement: false,
  manualMarks: true,
  validationMarks: true,
  connectorLines: false,
  diagnosticsLabels: false,
}

export function layersForDensityPreset(
  preset: SmcDensityPreset,
): SmcLabPreferences['layerToggles'] {
  switch (preset) {
    case 'minimal':
      return {
        ...DEFAULT_SMC_LAYER_TOGGLES,
        externalSwings: true,
        internalSwings: false,
        bosLabels: true,
        chochLabels: true,
        internalBreaks: false,
        activeFvg: false,
        activeOrderBlocks: false,
        equalLevels: false,
        liquiditySweeps: false,
        displacement: false,
        connectorLines: false,
        mitigatedFvg: false,
        invalidatedOrderBlocks: false,
      }
    case 'structure':
      return {
        ...DEFAULT_SMC_LAYER_TOGGLES,
        externalSwings: true,
        internalSwings: true,
        bosLabels: true,
        chochLabels: true,
        internalBreaks: true,
        activeFvg: false,
        activeOrderBlocks: false,
        equalLevels: false,
        liquiditySweeps: false,
        displacement: false,
      }
    case 'liquidity':
      return {
        ...DEFAULT_SMC_LAYER_TOGGLES,
        externalSwings: true,
        internalSwings: false,
        bosLabels: false,
        chochLabels: false,
        internalBreaks: false,
        equalLevels: true,
        liquiditySweeps: true,
        activeFvg: true,
        activeOrderBlocks: true,
        displacement: false,
      }
    case 'full-debug':
      return {
        ...DEFAULT_SMC_LAYER_TOGGLES,
        externalSwings: true,
        internalSwings: true,
        bosLabels: true,
        chochLabels: true,
        internalBreaks: true,
        bosLines: true,
        activeFvg: true,
        mitigatedFvg: true,
        activeOrderBlocks: true,
        invalidatedOrderBlocks: true,
        equalLevels: true,
        liquiditySweeps: true,
        displacement: true,
        connectorLines: true,
        diagnosticsLabels: true,
      }
    default:
      return { ...DEFAULT_SMC_LAYER_TOGGLES }
  }
}

const DEFAULT_PREFS: SmcLabPreferences = {
  schemaVersion: 2,
  activeConfigId: null,
  activeProfileId: 'quantlab-default',
  detectorConfig: cloneSmcDetectorConfig(DEFAULT_SMC_DETECTOR_CONFIG),
  layerToggles: { ...DEFAULT_SMC_LAYER_TOGGLES },
  densityPreset: 'structure',
  visibilityMode: 'balanced',
  smartVisibilityPreset: 'balanced',
  zoneLifecycle: {
    showActive: true,
    showTouched: true,
    showMitigatedFilled: false,
    showInvalidated: false,
    extendActiveZonesRight: true,
    fadeOldActiveZones: true,
  },
  playSpeed: 1,
  compareProfileId: null,
}

/** In-memory fallback when localStorage is unavailable (tests / private mode). */
let memoryPrefs: SmcLabPreferences | null = null
let memoryConfigs: SmcSavedLabConfig[] | null = null

export function loadSmcLabPreferences(): SmcLabPreferences {
  if (!canUseStorage()) {
    if (!memoryPrefs) {
      memoryPrefs = {
        ...DEFAULT_PREFS,
        detectorConfig: cloneSmcDetectorConfig(),
        layerToggles: { ...DEFAULT_SMC_LAYER_TOGGLES },
      }
    }
    return {
      ...memoryPrefs,
      detectorConfig: cloneSmcDetectorConfig(memoryPrefs.detectorConfig),
      layerToggles: { ...memoryPrefs.layerToggles },
    }
  }
  try {
    const raw = localStorage.getItem(SMC_LAB_PREFS_STORAGE_KEY)
    if (!raw) {
      if (memoryPrefs) {
        return {
          ...memoryPrefs,
          detectorConfig: cloneSmcDetectorConfig(memoryPrefs.detectorConfig),
          layerToggles: { ...memoryPrefs.layerToggles },
        }
      }
      return {
        ...DEFAULT_PREFS,
        detectorConfig: cloneSmcDetectorConfig(),
        layerToggles: { ...DEFAULT_SMC_LAYER_TOGGLES },
      }
    }
    const parsed = JSON.parse(raw) as Partial<SmcLabPreferences>
    return {
      ...DEFAULT_PREFS,
      ...parsed,
      schemaVersion: 2,
      activeProfileId: parsed.activeProfileId ?? 'quantlab-default',
      densityPreset: parsed.densityPreset ?? 'structure',
      visibilityMode: parsed.visibilityMode ?? 'balanced',
      smartVisibilityPreset: parsed.smartVisibilityPreset ?? 'balanced',
      zoneLifecycle: {
        showActive: true,
        showTouched: true,
        showMitigatedFilled: false,
        showInvalidated: false,
        extendActiveZonesRight: true,
        fadeOldActiveZones: true,
        ...parsed.zoneLifecycle,
      },
      compareProfileId: parsed.compareProfileId ?? null,
      detectorConfig: parsed.detectorConfig
        ? cloneSmcDetectorConfig(parsed.detectorConfig)
        : cloneSmcDetectorConfig(),
      layerToggles: { ...DEFAULT_SMC_LAYER_TOGGLES, ...parsed.layerToggles },
    }
  } catch {
    return {
      ...DEFAULT_PREFS,
      detectorConfig: cloneSmcDetectorConfig(),
      layerToggles: { ...DEFAULT_SMC_LAYER_TOGGLES },
    }
  }
}

export function saveSmcLabPreferences(prefs: SmcLabPreferences): void {
  memoryPrefs = {
    ...prefs,
    schemaVersion: 2,
    detectorConfig: cloneSmcDetectorConfig(prefs.detectorConfig),
    layerToggles: { ...prefs.layerToggles },
  }
  if (!canUseStorage()) return
  try {
    localStorage.setItem(SMC_LAB_PREFS_STORAGE_KEY, JSON.stringify(memoryPrefs))
  } catch {
    // quota
  }
}

export function updateSmcDetectorPrefs(config: SmcDetectorConfig): SmcLabPreferences {
  const prefs = loadSmcLabPreferences()
  const next = { ...prefs, detectorConfig: cloneSmcDetectorConfig(config) }
  saveSmcLabPreferences(next)
  return next
}

function seedDefaultConfigs(): SmcSavedLabConfig[] {
  const now = Date.now()
  return listBuiltinSmcPresets().map((preset, index) => ({
    id: preset.id,
    name: preset.name,
    config: cloneSmcDetectorConfig(preset.config),
    profileId: preset.profileId,
    createdAt: now + index,
    updatedAt: now + index,
    builtin: true,
  }))
}

function readConfigs(): SmcSavedLabConfig[] {
  if (memoryConfigs) {
    return memoryConfigs.map((c) => ({ ...c, config: cloneSmcDetectorConfig(c.config) }))
  }

  if (!canUseStorage()) {
    memoryConfigs = seedDefaultConfigs()
    return memoryConfigs.map((c) => ({ ...c, config: cloneSmcDetectorConfig(c.config) }))
  }
  try {
    const raw = localStorage.getItem(SMC_LAB_CONFIGS_STORAGE_KEY)
    if (!raw) {
      memoryConfigs = seedDefaultConfigs()
      writeConfigs(memoryConfigs)
      return memoryConfigs.map((c) => ({ ...c, config: cloneSmcDetectorConfig(c.config) }))
    }
    const parsed = JSON.parse(raw) as SmcSavedLabConfig[]
    memoryConfigs = Array.isArray(parsed) && parsed.length > 0 ? parsed : seedDefaultConfigs()
    return memoryConfigs.map((c) => ({ ...c, config: cloneSmcDetectorConfig(c.config) }))
  } catch {
    memoryConfigs = seedDefaultConfigs()
    return memoryConfigs.map((c) => ({ ...c, config: cloneSmcDetectorConfig(c.config) }))
  }
}

function writeConfigs(configs: SmcSavedLabConfig[]): void {
  memoryConfigs = configs.map((c) => ({ ...c, config: cloneSmcDetectorConfig(c.config) }))
  if (!canUseStorage()) return
  try {
    localStorage.setItem(SMC_LAB_CONFIGS_STORAGE_KEY, JSON.stringify(memoryConfigs))
  } catch {
    // ignore
  }
}

export function listSmcSavedConfigs(): SmcSavedLabConfig[] {
  return readConfigs().sort((a, b) => a.name.localeCompare(b.name))
}

export function saveSmcNamedConfig(input: {
  id?: string
  name: string
  config: SmcDetectorConfig
  profileId?: string
}): SmcSavedLabConfig {
  const configs = readConfigs()
  const now = Date.now()
  const id = input.id ?? `cfg-${now}`
  const existing = configs.findIndex((c) => c.id === id)
  if (existing >= 0 && configs[existing]!.builtin) {
    // Duplicate builtin into a custom copy instead of mutating.
    const entry: SmcSavedLabConfig = {
      id: `cfg-${now}`,
      name: input.name.trim() || `${configs[existing]!.name} copy`,
      config: cloneSmcDetectorConfig(input.config),
      profileId: input.profileId ?? configs[existing]!.profileId,
      createdAt: now,
      updatedAt: now,
      builtin: false,
    }
    configs.push(entry)
    writeConfigs(configs)
    return entry
  }
  const entry: SmcSavedLabConfig = {
    id,
    name: input.name.trim() || 'Untitled',
    config: cloneSmcDetectorConfig(input.config),
    profileId: input.profileId,
    createdAt: existing >= 0 ? configs[existing]!.createdAt : now,
    updatedAt: now,
    builtin: false,
  }
  if (existing >= 0) configs[existing] = entry
  else configs.push(entry)
  writeConfigs(configs)
  return entry
}

export function deleteSmcNamedConfig(id: string): boolean {
  const configs = readConfigs()
  const target = configs.find((c) => c.id === id)
  if (!target || target.builtin) return false
  const next = configs.filter((c) => c.id !== id)
  if (next.length === configs.length) return false
  writeConfigs(next)
  return true
}

export function renameSmcNamedConfig(id: string, name: string): SmcSavedLabConfig | null {
  const configs = readConfigs()
  const idx = configs.findIndex((c) => c.id === id)
  if (idx < 0 || configs[idx]!.builtin) return null
  const entry = {
    ...configs[idx]!,
    name: name.trim() || configs[idx]!.name,
    updatedAt: Date.now(),
  }
  configs[idx] = entry
  writeConfigs(configs)
  return entry
}

export function clearSmcLabLocalStorageForTests(): void {
  memoryPrefs = null
  memoryConfigs = null
  if (!canUseStorage()) return
  localStorage.removeItem(SMC_LAB_PREFS_STORAGE_KEY)
  localStorage.removeItem(SMC_LAB_CONFIGS_STORAGE_KEY)
  // Also clear v1 keys if present
  localStorage.removeItem('quantlab.smc-lab.prefs.v1')
  localStorage.removeItem('quantlab.smc-lab.configs.v1')
}
