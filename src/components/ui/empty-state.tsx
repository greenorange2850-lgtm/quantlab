import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: React.ReactNode
  className?: string
}

export function EmptyState({ title, description, icon, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex w-full max-w-md flex-col items-center justify-center px-4 py-12 text-center',
        className,
      )}
    >
      <div className="mb-4 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/5 text-muted">
        {icon ?? <Inbox className="h-6 w-6" />}
      </div>
      <h3 className="text-sm font-medium text-balance text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-pretty text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  )
}
