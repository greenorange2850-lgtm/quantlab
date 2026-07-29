import { Input } from '@/components/ui/input'
import type { SessionListFilters, SessionSortOption } from '../session-list-model'

interface SessionFiltersProps {
  filters: SessionListFilters
  markets: string[]
  timeframes: string[]
  onChange: (next: SessionListFilters) => void
  disabled?: boolean
}

const selectClassName =
  'flex h-11 w-full rounded-lg border border-border bg-white/[0.03] px-3 text-sm disabled:opacity-50'

export function SessionFilters({
  filters,
  markets,
  timeframes,
  onChange,
  disabled,
}: SessionFiltersProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="min-w-0 space-y-1.5">
        <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Search strategy
        </label>
        <Input
          value={filters.search}
          disabled={disabled}
          placeholder="Moving Average Cross"
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          className="w-full bg-white/[0.03]"
        />
      </div>

      <div className="min-w-0 space-y-1.5">
        <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Market
        </label>
        <select
          value={filters.market}
          disabled={disabled}
          onChange={(event) => onChange({ ...filters, market: event.target.value })}
          className={selectClassName}
        >
          <option value="" className="bg-card-solid">
            All markets
          </option>
          {markets.map((market) => (
            <option key={market} value={market} className="bg-card-solid">
              {market}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-0 space-y-1.5">
        <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Timeframe
        </label>
        <select
          value={filters.timeframe}
          disabled={disabled}
          onChange={(event) => onChange({ ...filters, timeframe: event.target.value })}
          className={selectClassName}
        >
          <option value="" className="bg-card-solid">
            All timeframes
          </option>
          {timeframes.map((timeframe) => (
            <option key={timeframe} value={timeframe} className="bg-card-solid">
              {timeframe}
            </option>
          ))}
        </select>
      </div>

      <div className="min-w-0 space-y-1.5">
        <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Sort
        </label>
        <select
          value={filters.sort}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...filters, sort: event.target.value as SessionSortOption })
          }
          className={selectClassName}
        >
          <option value="newest" className="bg-card-solid">
            Newest
          </option>
          <option value="profit" className="bg-card-solid">
            Profit
          </option>
          <option value="score" className="bg-card-solid">
            Score
          </option>
        </select>
      </div>
    </div>
  )
}
