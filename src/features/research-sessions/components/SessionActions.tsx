import { Link } from 'react-router-dom'
import { ArrowLeftRight, Eye, Loader2, MoreHorizontal, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { OpenReplayButton, isReplayAvailableForBacktest } from '@/features/backtest-replay'

interface SessionActionsProps {
  sessionId: string
  bestBacktestId?: string | null
  deleting?: boolean
  onDelete: (sessionId: string) => void
}

export function SessionActions({
  sessionId,
  bestBacktestId,
  deleting,
  onDelete,
}: SessionActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <Link to={`/strategies/${sessionId}`} className="w-full sm:w-auto">
        <Button className="min-h-11 w-full sm:min-h-9 sm:w-auto">
          <Eye className="mr-2 h-4 w-4" />
          Open Strategy
        </Button>
      </Link>
      {bestBacktestId ? (
        <OpenReplayButton
          backtestId={bestBacktestId}
          available={isReplayAvailableForBacktest(bestBacktestId)}
        />
      ) : null}
      <Link to={`/strategy-compare?strategy=${sessionId}`} className="w-full sm:w-auto">
        <Button variant="outline" className="min-h-11 w-full sm:min-h-9 sm:w-auto">
          <ArrowLeftRight className="mr-2 h-4 w-4" />
          Compare
        </Button>
      </Link>

      <div className="relative w-full sm:w-auto">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full sm:min-h-9 sm:w-auto"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MoreHorizontal className="mr-2 h-4 w-4" />
          More
        </Button>
        {menuOpen ? (
          <div
            role="menu"
            className={cn(
              'absolute right-0 z-20 mt-1 min-w-[10rem] rounded-lg border border-border',
              'bg-card-solid/95 p-1 shadow-xl backdrop-blur-xl',
            )}
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-danger hover:bg-danger/10"
              disabled={deleting}
              onClick={() => {
                setMenuOpen(false)
                onDelete(sessionId)
              }}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
