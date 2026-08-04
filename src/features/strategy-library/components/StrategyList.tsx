import type { StrategyListItem } from '@/strategies'
import { StrategyCard } from './StrategyCard'

interface StrategyListProps {
  items: StrategyListItem[]
  deletingId: string | null
  onDelete: (strategyId: string) => void
}

export function StrategyList({ items, deletingId, onDelete }: StrategyListProps) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {items.map((item) => (
        <StrategyCard
          key={item.id}
          item={item}
          deleting={deletingId === item.id}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
