import { useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { BookOpen } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { BUILTIN_PLAYBOOKS } from '@/core/playbook'
import { demoDiagnostics, demoPipelineResult } from '@/core/playbook/demo'
import { usePlaybookStore, isDraftDirty } from '@/stores/playbook.store'
import { ConfigurePanel } from './components/ConfigurePanel'
import { DecisionCard } from './components/DecisionCard'
import { DiagnosticsPanel } from './components/DiagnosticsPanel'
import { PlaybookSelector } from './components/PlaybookSelector'

export function PlaybookLabPage() {
  const selectedPlaybookId = usePlaybookStore((s) => s.selectedPlaybookId)
  const drafts = usePlaybookStore((s) => s.drafts)
  const applied = usePlaybookStore((s) => s.applied)
  const selectPlaybook = usePlaybookStore((s) => s.selectPlaybook)
  const setDraft = usePlaybookStore((s) => s.setDraft)
  const updateParameter = usePlaybookStore((s) => s.updateParameter)
  const resetDraft = usePlaybookStore((s) => s.resetDraft)
  const applyDraft = usePlaybookStore((s) => s.applyDraft)

  const definition = useMemo(
    () => BUILTIN_PLAYBOOKS.find((d) => d.id === selectedPlaybookId) ?? BUILTIN_PLAYBOOKS[0],
    [selectedPlaybookId],
  )

  useEffect(() => {
    if (!drafts[definition.id]) setDraft(definition.id, {})
  }, [definition.id, drafts, setDraft])

  const dirtyIds = useMemo(
    () =>
      BUILTIN_PLAYBOOKS.filter((d) => isDraftDirty({ drafts, applied }, d.id)).map((d) => d.id),
    [drafts, applied],
  )

  const result = useMemo(() => {
    const appliedParams = applied[definition.id] ?? drafts[definition.id] ?? {}
    try {
      return demoPipelineResult(definition.id, appliedParams)
    } catch {
      return null
    }
  }, [definition.id, applied, drafts])

  const dirty = isDraftDirty({ drafts, applied }, definition.id)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Playbook Lab</h1>
        <p className="text-xs text-muted-foreground">
          Trader-first decisions derived from detector outputs — read-only, deterministic and
          replayable.
        </p>
      </div>

      <PlaybookSelector
        definitions={BUILTIN_PLAYBOOKS}
        selectedId={definition.id}
        onSelect={selectPlaybook}
        dirtyIds={dirtyIds}
      />

      {result?.evaluation ? (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <DecisionCard evaluation={result.evaluation} />
            <DiagnosticsPanel diagnostics={demoDiagnostics(definition.id)} history={result.history} />
          </div>
          <ConfigurePanel
            definition={definition}
            draft={drafts[definition.id] ?? {}}
            dirty={dirty}
            onChange={(key, value) => updateParameter(definition.id, key, value)}
            onReset={() => resetDraft(definition.id, definition)}
            onApply={() => applyDraft(definition.id, definition)}
          />
        </div>
      ) : (
        <EmptyState
          title="No playbook evaluation available"
          description={`The ${definition.name} playbook could not be evaluated on the demo series.`}
          icon={<BookOpen className="h-6 w-6" />}
        />
      )}
    </motion.div>
  )
}
