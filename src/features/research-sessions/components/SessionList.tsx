import type { SessionListItem } from '../session-list-model'
import { SessionCard } from './SessionCard'

interface SessionListProps {
  items: SessionListItem[]
  deletingId: string | null
  onDelete: (sessionId: string) => void
}

export function SessionList({ items, deletingId, onDelete }: SessionListProps) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {items.map((item) => (
        <SessionCard
          key={item.id}
          item={item}
          deleting={deletingId === item.id}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
