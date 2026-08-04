import { Link } from 'react-router-dom'
import { Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { replayUnavailableMessage } from './load-replay'

interface OpenReplayButtonProps {
  backtestId: string
  available: boolean
  reason?: string
}

export function OpenReplayButton({ backtestId, available, reason }: OpenReplayButtonProps) {
  const message = reason ?? replayUnavailableMessage('slim_archive')

  if (!available) {
    return (
      <Tooltip content={message}>
        <span className="inline-flex w-full sm:w-auto" title={message}>
          <Button type="button" disabled className="min-h-11 w-full sm:min-h-9 sm:w-auto">
            <Play className="h-3.5 w-3.5" />
            Open Replay
          </Button>
        </span>
      </Tooltip>
    )
  }

  return (
    <Link to={`/backtest-replay?backtest=${encodeURIComponent(backtestId)}`} className="w-full sm:w-auto">
      <Button type="button" className="min-h-11 w-full sm:min-h-9 sm:w-auto">
        <Play className="h-3.5 w-3.5" />
        Open Replay
      </Button>
    </Link>
  )
}
