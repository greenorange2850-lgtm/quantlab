import { Search, Command, Bell, RefreshCw, Menu } from 'lucide-react'
import { motion } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useBacktestStore } from '@/stores/backtest.store'
import { MENU_BUTTON, TOP_NAV_ACTIONS } from './layout-classes'

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
    <header className="sticky top-0 z-30 flex h-14 min-w-0 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur-xl sm:px-4 lg:gap-4 lg:px-6">
      {/* Left: menu (mobile) — fixed width so title/actions stay balanced */}
      <div className="flex w-11 shrink-0 items-center justify-start lg:hidden">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={MENU_BUTTON}
          aria-label="Open navigation menu"
          aria-expanded={menuOpen}
          aria-controls="app-sidebar"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Center / desktop-left: title + strategy meta */}
      <div className="flex min-w-0 flex-1 items-center gap-2 lg:gap-4">
        <h1 className="truncate text-base font-semibold tracking-tight lg:text-lg">{title}</h1>
        <div className="hidden min-w-0 items-center gap-2 lg:flex">
          <Badge variant="success" className="shrink-0 text-[10px]">
            {activeStrategy.status}
          </Badge>
          <span className="truncate text-xs text-muted-foreground">
            {activeStrategy.name} · {activeStrategy.version}
          </span>
        </div>
      </div>

      {/* Right: actions — reserved cluster for search / notifications / future controls */}
      <div className={TOP_NAV_ACTIONS}>
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
          className="relative hidden h-11 w-11 sm:inline-flex lg:h-8 lg:w-8"
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
            className="h-11 w-11 lg:h-8 lg:w-8"
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
