import { ListChecks } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface WhatsChangedCardProps {
  lines: string[]
}

export function WhatsChangedCard({ lines }: WhatsChangedCardProps) {
  return (
    <Card hover={false}>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <ListChecks className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-base">What&apos;s Changed</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {lines.map((line) => (
            <li key={line} className="flex items-start gap-2 text-sm text-foreground/90">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/40" />
              <span className="text-pretty">{line}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
