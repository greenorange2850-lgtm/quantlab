// ─── Playbook Engine — Built-in Registry ──────────────────────────────────────
import { BUILTIN_PLAYBOOKS } from './definitions.js'
import { definitionIsValid } from './parameters.js'
import type { PlaybookDefinition } from './types.js'

export interface PlaybookRegistry {
  list(): readonly PlaybookDefinition[]
  get(id: string): PlaybookDefinition | null
  has(id: string): boolean
  find(bias: 'bullish' | 'bearish', kind: PlaybookDefinition['kind']): PlaybookDefinition | null
}

class BuiltinPlaybookRegistry implements PlaybookRegistry {
  private readonly byId = new Map<string, PlaybookDefinition>()

  constructor(definitions: readonly PlaybookDefinition[]) {
    for (const d of definitions) {
      if (!definitionIsValid(d)) {
        throw new Error(`Invalid playbook definition "${d.id}" rejected by registry`)
      }
      if (this.byId.has(d.id)) {
        throw new Error(`Duplicate playbook id "${d.id}" in registry`)
      }
      this.byId.set(d.id, d)
    }
  }

  list(): readonly PlaybookDefinition[] {
    return Array.from(this.byId.values())
  }

  get(id: string): PlaybookDefinition | null {
    return this.byId.get(id) ?? null
  }

  has(id: string): boolean {
    return this.byId.has(id)
  }

  find(bias: PlaybookDefinition['bias'], kind: PlaybookDefinition['kind']): PlaybookDefinition | null {
    return this.list().find((d) => d.bias === bias && d.kind === kind) ?? null
  }
}

/** Singleton registry of the four built-in playbooks. */
export const playbookRegistry: PlaybookRegistry = new BuiltinPlaybookRegistry(BUILTIN_PLAYBOOKS)
