import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-border bg-white/5 text-foreground',
        success: 'border-success/20 bg-success-muted text-success',
        danger: 'border-danger/20 bg-danger-muted text-danger',
        warning: 'border-warning/20 bg-warning-muted text-warning',
        accent: 'border-accent/20 bg-accent/10 text-accent-foreground',
        outline: 'border-border text-muted',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
