import { Search, Command, Bell, RefreshCw, Menu } from 'lucide-react'
import { motion } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useBacktestStore } from '@/stores/backtest.store'

interface TopNavProps {
  title?: string
  onMenuClick?: () => void
  menuOpen?: boolean
}

export function TopNav({ title = 'Dashboard', onMenuClick, menuOpen = false }: TopNavProps) {
  const activeStrategy = useBacktestStore((state) => state.dashboard.activeStrategy)
  const runBacktest = useBacktestStore((state) => state.runBacktest)
  const isRunning = useBacktestStore((state) => state.isRunning)

  return (
    <header className="sticky top-0 z-30 flex h-14 min-w-0 items-center justify-between gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-xl md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0 md:hidden"
          aria-label="Open navigation menu"
          aria-expanded={menuOpen}
          aria-controls="app-sidebar"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <h1 className="truncate text-base font-semibold tracking-tight md:text-lg">{title}</h1>
        <div className="hidden min-w-0 items-center gap-2 md:flex">
          <Badge variant="success" className="shrink-0 text-[10px]">
            {activeStrategy.status}
          </Badge>
          <span className="truncate text-xs text-muted-foreground">
            {activeStrategy.name} · {activeStrategy.version}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-3">
        <div className="relative hidden lg:block">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search strategies, backtests..."
            className="h-8 w-64 bg-white/[0.03] pl-9 text-xs"
          />
          <kbd className="absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded border border-border bg-white/5 px-1.5 py-0.5 text-[10px] text-muted-foreground xl:inline-flex">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="relative hidden h-11 w-11 sm:inline-flex md:h-8 md:w-8"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-[8px] font-bold text-white">
            3
          </span>
        </Button>

        <motion.div whileHover={{ rotate: 180 }} transition={{ duration: 0.4 }}>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 md:h-8 md:w-8"
            disabled={isRunning}
            aria-label="Refresh backtest"
            onClick={() => void runBacktest()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </motion.div>
      </div>
    </header>
  )
}
