import { Search, Command, Bell, RefreshCw } from 'lucide-react'
import { motion } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useBacktestStore } from '@/stores/backtest.store'

interface TopNavProps {
  title?: string
}

export function TopNav({ title = 'Dashboard' }: TopNavProps) {
  const activeStrategy = useBacktestStore((state) => state.dashboard.activeStrategy)
  const runBacktest = useBacktestStore((state) => state.runBacktest)
  const isRunning = useBacktestStore((state) => state.isRunning)

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 backdrop-blur-xl px-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        <div className="hidden md:flex items-center gap-2">
          <Badge variant="success" className="text-[10px]">
            {activeStrategy.status}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {activeStrategy.name} · {activeStrategy.version}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search strategies, backtests..."
            className="w-64 pl-9 h-8 text-xs bg-white/[0.03]"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden lg:inline-flex items-center gap-0.5 rounded border border-border bg-white/5 px-1.5 py-0.5 text-[10px] text-muted-foreground">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </div>

        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-[8px] font-bold text-white">
            3
          </span>
        </Button>

        <motion.div whileHover={{ rotate: 180 }} transition={{ duration: 0.4 }}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={isRunning}
            onClick={() => void runBacktest()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </motion.div>
      </div>
    </header>
  )
}
