import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface TradeNavigatorProps {
  tradeCount: number
  selectedIndex: number
  onSelect: (index: number) => void
}

function clampTradeIndex(index: number, tradeCount: number): number {
  return Math.max(0, Math.min(Math.max(0, tradeCount - 1), index))
}

export function TradeNavigator({ tradeCount, selectedIndex, onSelect }: TradeNavigatorProps) {
  const [jumpValue, setJumpValue] = useState(String(selectedIndex + 1))
  const hasTrades = tradeCount > 0

  useEffect(() => {
    setJumpValue(hasTrades ? String(selectedIndex + 1) : '')
  }, [hasTrades, selectedIndex])

  const select = (index: number) => {
    if (!hasTrades) return
    onSelect(clampTradeIndex(index, tradeCount))
  }

  const jumpToTrade = () => {
    const parsed = Number(jumpValue)
    if (!Number.isFinite(parsed)) return
    select(Math.trunc(parsed) - 1)
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-foreground">Trade Navigator</p>
        <p className="font-mono text-[11px] text-muted-foreground">
          {hasTrades ? `${selectedIndex + 1} / ${tradeCount}` : '0 / 0'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={!hasTrades || selectedIndex <= 0}
          onClick={() => select(0)}
        >
          First
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={!hasTrades || selectedIndex <= 0}
          onClick={() => select(selectedIndex - 1)}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={!hasTrades || selectedIndex >= tradeCount - 1}
          onClick={() => select(selectedIndex + 1)}
        >
          Next
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={!hasTrades || selectedIndex >= tradeCount - 1}
          onClick={() => select(tradeCount - 1)}
        >
          Last
        </Button>
      </div>

      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          jumpToTrade()
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
            Jump to Trade
          </span>
          <Input
            type="number"
            min={1}
            max={Math.max(1, tradeCount)}
            inputMode="numeric"
            value={jumpValue}
            disabled={!hasTrades}
            onChange={(event) => setJumpValue(event.target.value)}
            className="min-h-11 font-mono text-xs"
          />
        </label>
        <Button type="submit" className="min-h-11 shrink-0" disabled={!hasTrades}>
          Jump
        </Button>
      </form>
    </div>
  )
}
