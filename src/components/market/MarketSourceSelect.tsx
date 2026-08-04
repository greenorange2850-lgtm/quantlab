import { cn } from '@/lib/utils'
import {
  MARKET_SOURCE_OPTIONS,
  type MarketSourceKind,
} from '@/data/market-source'

interface MarketSourceSelectProps {
  value: MarketSourceKind
  onChange: (value: MarketSourceKind) => void
  disabled?: boolean
  id?: string
  className?: string
}

export function MarketSourceSelect({
  value,
  onChange,
  disabled,
  id = 'market-source',
  className,
}: MarketSourceSelectProps) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as MarketSourceKind)}
      className={cn(
        'flex h-11 w-full rounded-lg border border-border bg-white/[0.03] px-3 text-sm disabled:opacity-50',
        className,
      )}
    >
      {MARKET_SOURCE_OPTIONS.map((option) => (
        <option key={option.id} value={option.id} className="bg-card-solid">
          {option.label}
        </option>
      ))}
    </select>
  )
}
