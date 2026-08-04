import { Link } from 'react-router-dom'
import { SlidersHorizontal } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function StrategyLibraryEmptyState() {
  return (
    <Card hover={false} className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="space-y-1">
          <p className="text-sm font-medium">No strategies yet</p>
          <p className="text-xs text-muted-foreground">
            Start New Research, run Random Search, then Save Strategy.
          </p>
        </div>
        <Link to="/optimizer" className="w-full sm:w-auto">
          <Button className="min-h-11 w-full sm:min-h-9 sm:w-auto">
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            New Research
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
