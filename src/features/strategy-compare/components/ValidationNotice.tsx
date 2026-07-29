import { ShieldAlert } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function ValidationNotice() {
  return (
    <Card hover={false} className="border-border/80 bg-white/[0.02]">
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-white/[0.03]">
          <ShieldAlert className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">Validation Notice</p>
            <Badge variant="outline" className="text-[10px]">
              Historical comparison only
            </Badge>
          </div>
          <p className="text-pretty text-xs text-muted-foreground">
            Historical comparison only.
          </p>
          <p className="text-pretty text-xs text-muted-foreground">
            Further validation is recommended before live deployment.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
