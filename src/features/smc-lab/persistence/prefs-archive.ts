import {
  cloneSmcDetectorConfig,
  DEFAULT_SMC_DETECTOR_CONFIG,
  type SmcDetectorConfig,
} from '@/core/smc'
import {
  SMC_LAB_CONFIGS_STORAGE_KEY,
  SMC_LAB_PREFS_STORAGE_KEY,
  type SmcLabPreferences,
  type SmcSavedLabConfig,
} from './types'

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

const DEFAULT_PREFS: SmcLabPreferences = {
  schemaVersion: 1,
  activeConfigId: null,
  detectorConfig: cloneSmcDetectorConfig(DEFAULT_SMC_DETECTOR_CONFIG),
  layerToggles: {
    swings: true,
    bosLabels: true,
    bosLines: true,
    manualMarks: true,
    validationMarks: true,
  },
  playSpeed: 1,
}

/** In-memory fallback when localStorage is unavailable (tests / private mode). */
let memoryPrefs: SmcLabPreferences | null = null
let memoryConfigs: SmcSavedLabConfig[] | null = null

export function loadSmcLabPreferences(): SmcLabPreferences {
  if (!canUseStorage()) {
    if (!memoryPrefs) {
      memoryPrefs = { ...DEFAULT_PREFS, detectorConfig: cloneSmcDetectorConfig() }
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
      return { ...DEFAULT_PREFS, detectorConfig: cloneSmcDetectorConfig() }
    }
    const parsed = JSON.parse(raw) as Partial<SmcLabPreferences>
    return {
      ...DEFAULT_PREFS,
      ...parsed,
      schemaVersion: 1,
      detectorConfig: parsed.detectorConfig
        ? cloneSmcDetectorConfig(parsed.detectorConfig)
        : cloneSmcDetectorConfig(),
      layerToggles: { ...DEFAULT_PREFS.layerToggles, ...parsed.layerToggles },
    }
  } catch {
    return { ...DEFAULT_PREFS, detectorConfig: cloneSmcDetectorConfig() }
  }
}

export function saveSmcLabPreferences(prefs: SmcLabPreferences): void {
  memoryPrefs = {
    ...prefs,
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
  return [
    {
      id: 'cfg-default-5-5',
      name: 'Default 5/5',
      config: cloneSmcDetectorConfig({
        ...DEFAULT_SMC_DETECTOR_CONFIG,
        swing: { ...DEFAULT_SMC_DETECTOR_CONFIG.swing, pivotLeft: 5, pivotRight: 5 },
      }),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cfg-sensitive-3-3',
      name: 'Sensitive 3/3',
      config: cloneSmcDetectorConfig({
        ...DEFAULT_SMC_DETECTOR_CONFIG,
        swing: { ...DEFAULT_SMC_DETECTOR_CONFIG.swing, pivotLeft: 3, pivotRight: 3 },
      }),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cfg-conservative-7-7',
      name: 'Conservative 7/7',
      config: cloneSmcDetectorConfig({
        ...DEFAULT_SMC_DETECTOR_CONFIG,
        swing: { ...DEFAULT_SMC_DETECTOR_CONFIG.swing, pivotLeft: 7, pivotRight: 7 },
      }),
      createdAt: now,
      updatedAt: now,
    },
  ]
}

function readConfigs(): SmcSavedLabConfig[] {
  if (memoryConfigs) return memoryConfigs.map((c) => ({ ...c, config: cloneSmcDetectorConfig(c.config) }))

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
    memoryConfigs = Array.isArray(parsed) ? parsed : seedDefaultConfigs()
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
}): SmcSavedLabConfig {
  const configs = readConfigs()
  const now = Date.now()
  const id = input.id ?? `cfg-${now}`
  const existing = configs.findIndex((c) => c.id === id)
  const entry: SmcSavedLabConfig = {
    id,
    name: input.name.trim() || 'Untitled',
    config: cloneSmcDetectorConfig(input.config),
    createdAt: existing >= 0 ? configs[existing]!.createdAt : now,
    updatedAt: now,
  }
  if (existing >= 0) configs[existing] = entry
  else configs.push(entry)
  writeConfigs(configs)
  return entry
}

export function deleteSmcNamedConfig(id: string): boolean {
  const configs = readConfigs()
  const next = configs.filter((c) => c.id !== id)
  if (next.length === configs.length) return false
  writeConfigs(next)
  return true
}

export function clearSmcLabLocalStorageForTests(): void {
  memoryPrefs = null
  memoryConfigs = null
  if (!canUseStorage()) return
  localStorage.removeItem(SMC_LAB_PREFS_STORAGE_KEY)
  localStorage.removeItem(SMC_LAB_CONFIGS_STORAGE_KEY)
}
