import { motion } from 'framer-motion'
import { Play, Pause, SkipBack, SkipForward, Gauge } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

/**
 * Mobile-first Trade Replay shell (UI only — no replay engine wiring yet).
 * Controls stack vertically on small screens; chart fills available width.
 */
export function TradeReplayPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex min-w-0 w-full flex-col gap-4"
    >
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight">Trade Replay</h2>
        <p className="text-pretty text-xs text-muted-foreground">
          Step through historical trades with chart replay and pattern visualization.
        </p>
      </div>

      <Card className="min-w-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Replay Controls</CardTitle>
        </CardHeader>
        <CardContent className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row">
            <Button variant="secondary" className="min-h-11 w-full sm:min-h-9 sm:w-auto" disabled>
              <SkipBack className="mr-2 h-4 w-4" />
              Prev
            </Button>
            <Button className="min-h-11 w-full sm:min-h-9 sm:w-auto" disabled>
              <Play className="mr-2 h-4 w-4" />
              Play
            </Button>
            <Button variant="secondary" className="min-h-11 w-full sm:min-h-9 sm:w-auto" disabled>
              <Pause className="mr-2 h-4 w-4" />
              Pause
            </Button>
            <Button variant="secondary" className="min-h-11 w-full sm:min-h-9 sm:w-auto" disabled>
              <SkipForward className="mr-2 h-4 w-4" />
              Next
            </Button>
          </div>
          <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
            <Gauge className="h-4 w-4 shrink-0 text-muted" />
            <Badge variant="outline" className="text-[10px]">
              Speed 1x
            </Badge>
            <span className="text-xs text-muted-foreground">Coming soon</span>
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Chart</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 pb-4">
          <div className="flex h-[220px] w-full min-w-0 items-center justify-center rounded-lg border border-dashed border-border bg-white/[0.02] sm:h-[320px]">
            <p className="px-4 text-center text-pretty text-xs text-muted-foreground">
              Replay chart will fill this width once the feed is connected.
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
