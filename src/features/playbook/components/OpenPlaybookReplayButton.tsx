import { Link } from 'react-router-dom'
import { Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { playbookReplaySearch } from '../replay-markers'

interface OpenPlaybookReplayButtonProps {
  kind: 'backtest' | 'dataset'
  id: string
  playbookId: string
  timeframe?: string | null
  setupCandleIndex?: number | null
  disabled?: boolean
  disabledReason?: string
}

export function OpenPlaybookReplayButton({
  kind,
  id,
  playbookId,
  timeframe,
  setupCandleIndex,
  disabled,
  disabledReason,
}: OpenPlaybookReplayButtonProps) {
  if (disabled) {
    return (
      <Button type="button" disabled className="min-h-11 w-full sm:min-h-9 sm:w-auto" title={disabledReason}>
        <Play className="h-3.5 w-3.5" />
        Open in Replay
      </Button>
    )
  }

  return (
    <Link
      to={playbookReplaySearch({ kind, id, playbookId, timeframe, setupCandleIndex })}
      className="w-full sm:w-auto"
    >
      <Button type="button" className="min-h-11 w-full sm:min-h-9 sm:w-auto">
        <Play className="h-3.5 w-3.5" />
        Open in Replay
      </Button>
    </Link>
  )
}
