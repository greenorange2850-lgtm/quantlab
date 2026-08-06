// ─── Playbook Engine — Persistence & Migration ────────────────────────────────
//
// Saves the selected playbook, parameters, version and fingerprint. Supports
// schema migration of previously-saved (or externally produced) configs.

import { defaultParameters, resolveParameters } from './parameters.js'
import { fingerprintPlaybookConfig } from './serialization.js'
import type {
  PlaybookConfig,
  PlaybookDefinition,
  PlaybookParameters,
} from './types.js'

export const PLAYBOOK_CONFIG_SCHEMA_VERSION = 1

export interface MigrationResult {
  config: PlaybookConfig | null
  migrated: boolean
  notes: string[]
}

export function buildPlaybookConfig(
  definition: PlaybookDefinition,
  parameters: PlaybookParameters,
  savedAt = new Date().toISOString(),
): PlaybookConfig {
  const resolved = resolveParameters(definition, parameters)
  return {
    schemaVersion: PLAYBOOK_CONFIG_SCHEMA_VERSION,
    playbookId: definition.id,
    playbookVersion: definition.version,
    parameters: resolved,
    fingerprint: fingerprintPlaybookConfig(definition.id, definition.version, resolved),
    savedAt,
  }
}

/**
 * Migrate an unknown persisted shape into a valid PlaybookConfig.
 * Unknown playbooks / malformed payloads return `config: null`.
 */
export function migratePlaybookConfig(
  raw: unknown,
  definitions: readonly PlaybookDefinition[],
): MigrationResult {
  const notes: string[] = []
  let migrated = false

  if (raw === null || typeof raw !== 'object') {
    return { config: null, migrated: false, notes: ['Payload is not an object'] }
  }

  const source = raw as Record<string, unknown>
  let schemaVersion = typeof source.schemaVersion === 'number' ? source.schemaVersion : 0
  if (schemaVersion !== PLAYBOOK_CONFIG_SCHEMA_VERSION) {
    notes.push(`Migrating schemaVersion ${schemaVersion} → ${PLAYBOOK_CONFIG_SCHEMA_VERSION}`)
    schemaVersion = PLAYBOOK_CONFIG_SCHEMA_VERSION
    migrated = true
  }

  const playbookId = typeof source.playbookId === 'string' ? source.playbookId : ''
  const definition = definitions.find((d) => d.id === playbookId)
  if (!definition) {
    return {
      config: null,
      migrated,
      notes: [...notes, `Unknown playbook "${playbookId || '(empty)'}"`],
    }
  }

  let parameters: PlaybookParameters = {}
  if (source.parameters && typeof source.parameters === 'object' && !Array.isArray(source.parameters)) {
    parameters = source.parameters as PlaybookParameters
  } else {
    notes.push('Parameters missing — using defaults')
    migrated = true
  }

  const resolved = resolveParameters(definition, parameters)
  if (canonicalParams(parameters) !== canonicalParams(resolved)) {
    notes.push('Parameters normalized to schema defaults/clamps')
    migrated = true
  }

  const version = typeof source.playbookVersion === 'string' ? source.playbookVersion : definition.version
  if (version !== definition.version) {
    notes.push(`Version migrated from ${version} → ${definition.version}`)
    migrated = true
  }

  const expectedFingerprint = fingerprintPlaybookConfig(definition.id, definition.version, resolved)
  let fingerprint = typeof source.fingerprint === 'string' ? source.fingerprint : ''
  if (fingerprint !== expectedFingerprint) {
    notes.push('Fingerprint recomputed')
    fingerprint = expectedFingerprint
    migrated = true
  }

  return {
    config: {
      schemaVersion,
      playbookId: definition.id,
      playbookVersion: definition.version,
      parameters: resolved,
      fingerprint,
      savedAt: typeof source.savedAt === 'string' ? source.savedAt : new Date().toISOString(),
    },
    migrated,
    notes,
  }
}

export function configIsCurrent(config: PlaybookConfig): boolean {
  return config.schemaVersion === PLAYBOOK_CONFIG_SCHEMA_VERSION
}

function canonicalParams(params: PlaybookParameters): string {
  return JSON.stringify(Object.keys(params).sort().map((k) => [k, params[k]]))
}

export { defaultParameters }
