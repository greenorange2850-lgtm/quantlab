import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { adjacentSetupIndex, clampSetupIndex } from '../replay-markers'

interface PlaybookSetupNavigatorProps {
  setupCount: number
  selectedIndex: number
  onSelect: (index: number) => void
}

export function PlaybookSetupNavigator({
  setupCount,
  selectedIndex,
  onSelect,
}: PlaybookSetupNavigatorProps) {
  const [jumpValue, setJumpValue] = useState(String(selectedIndex + 1))
  const hasSetups = setupCount > 0

  useEffect(() => {
    setJumpValue(hasSetups ? String(selectedIndex + 1) : '')
  }, [hasSetups, selectedIndex])

  const select = (index: number) => {
    if (!hasSetups) return
    onSelect(clampSetupIndex(index, setupCount))
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-foreground">Playbook Setup Navigator</p>
        <p className="font-mono text-[11px] text-muted-foreground">
          {hasSetups ? `${selectedIndex + 1} / ${setupCount}` : '0 / 0'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={!hasSetups || selectedIndex <= 0}
          onClick={() => select(0)}
        >
          First
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={!hasSetups || selectedIndex <= 0}
          onClick={() => select(adjacentSetupIndex(selectedIndex, setupCount, -1))}
        >
          Previous Playbook Setup
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={!hasSetups || selectedIndex >= setupCount - 1}
          onClick={() => select(adjacentSetupIndex(selectedIndex, setupCount, 1))}
        >
          Next Playbook Setup
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={!hasSetups || selectedIndex >= setupCount - 1}
          onClick={() => select(setupCount - 1)}
        >
          Last
        </Button>
      </div>

      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const parsed = Number(jumpValue)
          if (!Number.isFinite(parsed)) return
          select(Math.trunc(parsed) - 1)
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
            Jump to setup
          </span>
          <Input
            type="number"
            min={1}
            max={Math.max(1, setupCount)}
            inputMode="numeric"
            value={jumpValue}
            disabled={!hasSetups}
            onChange={(event) => setJumpValue(event.target.value)}
            className="min-h-11 font-mono text-xs"
          />
        </label>
        <Button type="submit" className="min-h-11 shrink-0" disabled={!hasSetups}>
          Jump
        </Button>
      </form>
    </div>
  )
}
