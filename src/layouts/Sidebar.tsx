import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Layers,
  FlaskConical,
  Globe,
  Play,
  Brain,
  BookOpen,
  SlidersHorizontal,
  FileText,
  Settings,
  TrendingUp,
  Wifi,
  WifiOff,
  Crown,
  ChevronRight,
} from 'lucide-react'
import { NAV_ITEMS } from '@trading-os/shared'
import { cn } from '@/lib/utils'
import { userProfile } from '@/mock/dashboard'
import { useAppStore } from '@/stores/app.store'

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Layers,
  FlaskConical,
  Globe,
  Play,
  Brain,
  BookOpen,
  SlidersHorizontal,
  FileText,
  Settings,
}

export function Sidebar() {
  const location = useLocation()
  const connectionStatus = useAppStore((s) => s.connectionStatus)

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-[240px] flex-col border-r border-border bg-card-solid/80 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-purple-600 shadow-[0_0_20px_rgba(99,102,241,0.3)]">
          <TrendingUp className="h-5 w-5 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold tracking-tight text-foreground leading-tight">
            AI Trading
          </span>
          <span className="text-[10px] text-muted-foreground leading-tight">Research OS</span>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-2 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = iconMap[item.icon]
          const isActive = location.pathname === item.path

          return (
            <Link key={item.id} to={item.path}>
              <motion.div
                className={cn(
                  'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-accent/10 text-foreground'
                    : 'text-muted hover:bg-white/5 hover:text-foreground',
                )}
                whileHover={{ x: 2 }}
                transition={{ duration: 0.15 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 rounded-lg border border-accent/20 bg-accent/5"
                    transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                  />
                )}
                {Icon && <Icon className={cn('relative h-4 w-4', isActive && 'text-accent')} />}
                <span className="relative flex-1 font-medium">{item.label}</span>
              </motion.div>
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-border p-3 space-y-2">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/5 transition-colors cursor-pointer">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent/30 to-purple-600/30 text-xs font-semibold text-foreground border border-border">
            {userProfile.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{userProfile.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{userProfile.email}</p>
          </div>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        </div>

        <div className="flex items-center justify-between px-3 py-1.5">
          <div className="flex items-center gap-2">
            <Crown className="h-3.5 w-3.5 text-warning" />
            <span className="text-[10px] font-medium text-muted uppercase tracking-wider">
              {userProfile.subscription}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {connectionStatus === 'connected' ? (
              <>
                <Wifi className="h-3 w-3 text-success" />
                <span className="text-[10px] text-success">Live</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 text-danger" />
                <span className="text-[10px] text-danger">Offline</span>
              </>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}
