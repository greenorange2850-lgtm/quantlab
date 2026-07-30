import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DisclosureProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  className?: string
  /** Quieter chrome for nested metric grids. */
  variant?: 'card' | 'plain'
}

/**
 * Progressive disclosure — secondary content stays collapsed by default.
 * Native <details> for accessibility without new state libraries.
 */
export function Disclosure({
  title,
  children,
  defaultOpen = false,
  className,
  variant = 'card',
}: DisclosureProps) {
  return (
    <details
      className={cn(
        'group min-w-0',
        variant === 'card' &&
          'rounded-xl border border-border/70 bg-white/[0.02] open:bg-white/[0.03]',
        className,
      )}
      open={defaultOpen || undefined}
    >
      <summary
        className={cn(
          'flex cursor-pointer list-none items-center justify-between gap-3',
          'text-sm font-medium text-muted-foreground transition-colors',
          'hover:text-foreground',
          '[&::-webkit-details-marker]:hidden',
          variant === 'card' && 'px-4 py-3.5',
          variant === 'plain' && 'py-2',
        )}
      >
        <span>{title}</span>
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div
        className={cn(
          variant === 'card' && 'border-t border-border/50 px-4 pb-4 pt-3',
          variant === 'plain' && 'pt-2',
        )}
      >
        {children}
      </div>
    </details>
  )
}
