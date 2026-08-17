// ─── Playbook Engine — Parameter Validation & Normalization ───────────────────
import type {
  ParameterValue,
  PlaybookDefinition,
  PlaybookParameterSchema,
  PlaybookParameters,
} from './types.js'

export interface ParameterIssue {
  key: string
  message: string
}

/** Default parameter payload for a definition (all schema defaults). */
export function defaultParameters(definition: PlaybookDefinition): PlaybookParameters {
  const out: PlaybookParameters = {}
  for (const p of definition.parameterSchema) out[p.key] = p.default
  return out
}

/** Fill missing keys with schema defaults; clamp numeric ranges. */
export function resolveParameters(
  definition: PlaybookDefinition,
  input: PlaybookParameters,
): PlaybookParameters {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const out = defaultParameters(definition)
  for (const p of definition.parameterSchema) {
    const value = source[p.key]
    if (value === undefined) continue
    const normalized = clampParameterValue(p, value)
    if (normalized !== null) out[p.key] = normalized
  }
  return out
}

function clampParameterValue(
  schema: PlaybookParameterSchema,
  value: ParameterValue,
): ParameterValue | null {
  if (schema.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null
    let n = value
    if (schema.min !== undefined) n = Math.max(schema.min, n)
    if (schema.max !== undefined) n = Math.min(schema.max, n)
    return n
  }
  if (schema.type === 'boolean') {
    return value === true || value === false ? value : null
  }
  if (schema.type === 'select') {
    if (typeof value !== 'string') return null
    if (schema.options && !schema.options.includes(value)) {
      return schema.default
    }
    return value
  }
  return null
}

/** Validate user-supplied parameters, reporting each out-of-range/wrong-type key. */
export function validateParameters(
  definition: PlaybookDefinition,
  input: PlaybookParameters,
): ParameterIssue[] {
  const issues: ParameterIssue[] = []
  const known = new Set(definition.parameterSchema.map((p) => p.key))

  for (const key of Object.keys(input)) {
    if (!known.has(key)) {
      issues.push({ key, message: `Unknown parameter "${key}"` })
      continue
    }
    const schema = definition.parameterSchema.find((p) => p.key === key)!
    const value = input[key]
    if (schema.type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        issues.push({ key, message: `"${key}" must be a finite number` })
        continue
      }
      if (schema.min !== undefined && value < schema.min) {
        issues.push({ key, message: `"${key}" below minimum ${schema.min}` })
      }
      if (schema.max !== undefined && value > schema.max) {
        issues.push({ key, message: `"${key}" above maximum ${schema.max}` })
      }
    } else if (schema.type === 'boolean') {
      if (typeof value !== 'boolean') {
        issues.push({ key, message: `"${key}" must be a boolean` })
      }
    } else if (schema.type === 'select') {
      if (typeof value !== 'string' || (schema.options && !schema.options.includes(value))) {
        issues.push({ key, message: `"${key}" must be one of ${(schema.options ?? []).join(', ')}` })
      }
    }
  }
  return issues
}

/** True when a parameter payload is fully valid for the definition. */
export function areParametersValid(definition: PlaybookDefinition, input: PlaybookParameters): boolean {
  return validateParameters(definition, input).length === 0
}

/** Structural integrity of a definition (invariant checks for the registry). */
export function validateDefinition(definition: PlaybookDefinition): string[] {
  const failures: string[] = []
  if (!definition.id || typeof definition.id !== 'string') failures.push('definition.id missing')
  if (!definition.name) failures.push('definition.name missing')
  if (!definition.version) failures.push('definition.version missing')
  if (definition.kind !== 'qml-reversal' && definition.kind !== 'continuation') {
    failures.push('definition.kind invalid')
  }
  if (definition.bias !== 'bullish' && definition.bias !== 'bearish') {
    failures.push('definition.bias invalid')
  }
  if (!Array.isArray(definition.parameterSchema)) failures.push('parameterSchema missing')
  const keys = new Set<string>()
  for (const p of definition.parameterSchema) {
    if (!p.key || !p.label || p.type === undefined) {
      failures.push('parameterSchema entry incomplete')
    }
    if (keys.has(p.key)) failures.push(`duplicate parameter key "${p.key}"`)
    keys.add(p.key)
    if (p.type === 'number' && (p.min === undefined || p.max === undefined)) {
      failures.push(`number parameter "${p.key}" must declare min/max`)
    }
    if (p.type === 'select' && (!p.options || p.options.length === 0)) {
      failures.push(`select parameter "${p.key}" must declare options`)
    }
  }
  if (!Array.isArray(definition.checks) || definition.checks.length === 0) {
    failures.push('definition.checks empty')
  }
  const checkIds = new Set<string>()
  for (const c of definition.checks) {
    if (!c.id) failures.push('check missing id')
    if (checkIds.has(c.id)) failures.push(`duplicate check id "${c.id}"`)
    checkIds.add(c.id)
  }
  if (!definition.serialized || typeof definition.serialized !== 'string') {
    failures.push('definition.serialized missing')
  }
  return failures
}

export function definitionIsValid(definition: PlaybookDefinition): boolean {
  return validateDefinition(definition).length === 0
}
