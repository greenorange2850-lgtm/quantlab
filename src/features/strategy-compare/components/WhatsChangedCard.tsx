import { ListChecks } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { directionLabel, type WhatsChangedItem } from '../compare-metrics'

interface WhatsChangedCardProps {
  items: WhatsChangedItem[]
}

export function WhatsChangedCard({ items }: WhatsChangedCardProps) {
  return (
    <Card hover={false}>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <ListChecks className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-base">What&apos;s Changed</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2.5">
          {items.map((item) => (
            <li key={item.text} className="flex items-start gap-2 text-sm text-foreground/90">
              <span
                className={cn(
                  'mt-0.5 shrink-0 text-[10px] font-medium',
                  item.direction === 'improved' && 'text-success',
                  item.direction === 'decreased' && 'text-danger',
                  item.direction === 'unchanged' && 'text-muted-foreground',
                )}
                aria-label={directionLabel(item.direction)}
              >
                {item.direction === 'improved'
                  ? '↑'
                  : item.direction === 'decreased'
                    ? '↓'
                    : '→'}
              </span>
              <span className="text-pretty">{item.text}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
