import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { ParameterValue, PlaybookDefinition, PlaybookParameters } from '@/core/playbook'
import { defaultParameters } from '@/core/playbook'
import {
  PLAYBOOK_STORE_PERSIST_NAME,
  STORE_PERSIST_VERSION,
  getPersistStorage,
  partializePlaybookState,
  type PlaybookPersistedState,
} from './persistence'

interface PlaybookStoreState {
  /** Currently selected playbook id in the Lab. */
  selectedPlaybookId: string
  /** Working parameter drafts keyed by playbook id (editable, unapplied). */
  drafts: Record<string, PlaybookParameters>
  /** Last-applied parameter payloads keyed by playbook id. */
  applied: Record<string, PlaybookParameters>
  /** Demo fixtures vs a saved backtest/dataset. Demo is never an implicit fallback. */
  dataSourceKind: 'demo' | 'historical'
  selectedHistoricalKind: 'backtest' | 'dataset' | null
  selectedHistoricalId: string | null
  selectedHistoricalTimeframe: string | null
  selectPlaybook: (id: string) => void
  setDataSourceKind: (kind: 'demo' | 'historical') => void
  selectHistoricalSource: (
    kind: 'backtest' | 'dataset' | null,
    id: string | null,
    timeframe?: string | null,
  ) => void
  setHistoricalTimeframe: (timeframe: string | null) => void
  /** Patch a single draft parameter for a playbook. */
  updateParameter: (playbookId: string, key: string, value: ParameterValue) => void
  /** Replace the entire draft (e.g. seeded defaults on first visit). */
  setDraft: (playbookId: string, params: PlaybookParameters) => void
  /** Restore the draft to schema defaults. */
  resetDraft: (playbookId: string, definition: PlaybookDefinition) => void
  /** Mark the current draft as applied for a playbook. */
  applyDraft: (playbookId: string, definition: PlaybookDefinition) => void
}

export const usePlaybookStore = create<PlaybookStoreState>()(
  persist(
    (set) => ({
      selectedPlaybookId: 'bullish-qml-reversal',
      drafts: {},
      applied: {},
      dataSourceKind: 'demo',
      selectedHistoricalKind: null,
      selectedHistoricalId: null,
      selectedHistoricalTimeframe: null,
      selectPlaybook: (id) => set({ selectedPlaybookId: id }),
      setDataSourceKind: (kind) => set({ dataSourceKind: kind }),
      selectHistoricalSource: (kind, id, timeframe = null) =>
        set({
          dataSourceKind: 'historical',
          selectedHistoricalKind: kind,
          selectedHistoricalId: id,
          selectedHistoricalTimeframe: timeframe ?? null,
        }),
      setHistoricalTimeframe: (timeframe) => set({ selectedHistoricalTimeframe: timeframe }),
      updateParameter: (playbookId, key, value) =>
        set((s) => ({
          drafts: {
            ...s.drafts,
            [playbookId]: { ...(s.drafts[playbookId] ?? {}), [key]: value },
          },
        })),
      setDraft: (playbookId, params) =>
        set((s) => ({ drafts: { ...s.drafts, [playbookId]: params } })),
      resetDraft: (playbookId, definition) =>
        set((s) => ({
          drafts: { ...s.drafts, [playbookId]: defaultParameters(definition) },
        })),
      applyDraft: (playbookId, definition) =>
        set((s) => {
          const draft = s.drafts[playbookId]
          const resolved = draft
            ? { ...defaultParameters(definition), ...draft }
            : defaultParameters(definition)
          return {
            drafts: { ...s.drafts, [playbookId]: resolved },
            applied: { ...s.applied, [playbookId]: resolved },
          }
        }),
    }),
    {
      name: PLAYBOOK_STORE_PERSIST_NAME,
      version: STORE_PERSIST_VERSION,
      storage: createJSONStorage(getPersistStorage),
      partialize: (state): ReturnType<typeof partializePlaybookState> =>
        partializePlaybookState(state),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<PlaybookPersistedState>
        return {
          ...currentState,
          ...persisted,
          dataSourceKind: persisted.dataSourceKind === 'historical' ? 'historical' : 'demo',
          selectedHistoricalKind: persisted.selectedHistoricalKind ?? null,
          selectedHistoricalId: persisted.selectedHistoricalId ?? null,
          selectedHistoricalTimeframe: persisted.selectedHistoricalTimeframe ?? null,
        }
      },
    },
  ),
)

/** True when a playbook's draft differs from the last-applied payload. */
export function isDraftDirty(
  state: Pick<PlaybookStoreState, 'drafts' | 'applied'>,
  playbookId: string,
): boolean {
  const draft = state.drafts[playbookId]
  const applied = state.applied[playbookId]
  if (!draft) return false
  if (!applied) return true
  return canonicalParams(draft) !== canonicalParams(applied)
}

function canonicalParams(params: PlaybookParameters): string {
  return JSON.stringify(Object.keys(params).sort().map((k) => [k, params[k]]))
}
