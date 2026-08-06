import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { PlaybookDefinition } from '@/core/playbook'

interface PlaybookSelectorProps {
  definitions: readonly PlaybookDefinition[]
  selectedId: string
  onSelect: (id: string) => void
  dirtyIds: string[]
}

export function PlaybookSelector({ definitions, selectedId, onSelect, dirtyIds }: PlaybookSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {definitions.map((definition) => {
        const active = definition.id === selectedId
        const dirty = dirtyIds.includes(definition.id)
        return (
          <button
            key={definition.id}
            onClick={() => onSelect(definition.id)}
            className={cn(
              'flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors',
              active
                ? 'border-accent/40 bg-accent/10 text-foreground'
                : 'border-border bg-white/[0.02] text-muted hover:border-border-hover hover:text-foreground',
            )}
          >
            <span className="min-w-0 truncate text-xs font-medium">{definition.name}</span>
            {dirty && <Badge variant="warning" className="shrink-0 px-1.5 py-0 text-[9px]">dirty</Badge>}
          </button>
        )
      })}
    </div>
  )
}
