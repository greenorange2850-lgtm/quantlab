// ─── Playbook Engine — Serialization ──────────────────────────────────────────
//
// All serialization is JSON-safe and deterministic (canonical key order) so
// fingerprints are stable across runs and replays are byte-identical.

import { canonicalStringify, fingerprintHash } from './json.js'
import type {
  PlaybookConfig,
  PlaybookDefinition,
  PlaybookEvaluation,
  PlaybookParameters,
  PlaybookSerialization,
} from './types.js'

export const PLAYBOOK_SERIALIZATION_FORMAT = 'quantlab-playbook'
export const PLAYBOOK_CONFIG_SCHEMA_VERSION = 1

export function serializeEvaluation(evaluation: PlaybookEvaluation): string {
  return evaluation.serialized
}

export function deserializeEvaluation(definition: PlaybookDefinition, raw: string): PlaybookEvaluation {
  const data = JSON.parse(raw) as PlaybookEvaluation
  if (data.playbookId !== definition.id) {
    throw new Error(`Serialized evaluation belongs to "${data.playbookId}" not "${definition.id}"`)
  }
  return { ...data, serialized: raw }
}

/** Deterministic fingerprint for a playbook configuration (id + version + params). */
export function fingerprintPlaybookConfig(
  playbookId: string,
  playbookVersion: string,
  parameters: PlaybookParameters,
): string {
  return fingerprintHash(canonicalStringify({ playbookId, playbookVersion, parameters }))
}

export function serializePlaybookConfig(config: PlaybookConfig): string {
  return canonicalStringify({
    format: PLAYBOOK_SERIALIZATION_FORMAT,
    schemaVersion: PLAYBOOK_CONFIG_SCHEMA_VERSION,
    payload: {
      playbookId: config.playbookId,
      playbookVersion: config.playbookVersion,
      parameters: config.parameters,
      fingerprint: config.fingerprint,
      savedAt: config.savedAt,
    },
  })
}

export function wrapSerialization(payload: unknown, schemaVersion = 1): PlaybookSerialization {
  return { format: PLAYBOOK_SERIALIZATION_FORMAT, schemaVersion, payload }
}

export function parseSerialization(raw: string): PlaybookSerialization {
  const parsed = JSON.parse(raw) as PlaybookSerialization
  if (parsed.format !== PLAYBOOK_SERIALIZATION_FORMAT) {
    throw new Error(`Unknown playbook serialization format "${parsed.format}"`)
  }
  return parsed
}
