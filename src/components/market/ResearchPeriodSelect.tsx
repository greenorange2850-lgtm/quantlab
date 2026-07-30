import {
  DEFAULT_RESEARCH_PERIOD_PRESET,
  RESEARCH_PERIOD_PRESET_OPTIONS,
  dateInputToEndMs,
  dateInputToStartMs,
  msToDateInput,
  resolveResearchPeriod,
  type ResearchPeriodPreset,
  type ResearchPeriodSelection,
  type ResolvedResearchPeriod,
} from '@/data/research-period'
import { Input } from '@/components/ui/input'

interface ResearchPeriodSelectProps {
  selection: ResearchPeriodSelection
  onChange: (selection: ResearchPeriodSelection) => void
  disabled?: boolean
  /** Optional id prefix for labels. */
  idPrefix?: string
}

export function ResearchPeriodSelect({
  selection,
  onChange,
  disabled = false,
  idPrefix = 'research-period',
}: ResearchPeriodSelectProps) {
  const customStart = selection.customStartMs
    ? msToDateInput(selection.customStartMs)
    : ''
  const customEnd = selection.customEndMs ? msToDateInput(selection.customEndMs) : ''

  return (
    <div className="space-y-3">
      <div className="min-w-0 space-y-2">
        <label
          htmlFor={`${idPrefix}-preset`}
          className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
        >
          Research period
        </label>
        <select
          id={`${idPrefix}-preset`}
          value={selection.preset}
          disabled={disabled}
          onChange={(event) => {
            const preset = event.target.value as ResearchPeriodPreset
            onChange({ ...selection, preset })
          }}
          className="flex h-11 w-full rounded-lg border border-border bg-white/[0.03] px-3 text-sm"
        >
          {RESEARCH_PERIOD_PRESET_OPTIONS.map((option) => (
            <option key={option.id} value={option.id} className="bg-card-solid">
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {selection.preset === 'custom' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0 space-y-2">
            <label
              htmlFor={`${idPrefix}-start`}
              className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
            >
              Start date
            </label>
            <Input
              id={`${idPrefix}-start`}
              type="date"
              value={customStart}
              disabled={disabled}
              onChange={(event) => {
                const startMs = dateInputToStartMs(event.target.value)
                onChange({ ...selection, customStartMs: startMs })
              }}
              className="w-full bg-white/[0.03]"
            />
          </div>
          <div className="min-w-0 space-y-2">
            <label
              htmlFor={`${idPrefix}-end`}
              className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
            >
              End date
            </label>
            <Input
              id={`${idPrefix}-end`}
              type="date"
              value={customEnd}
              disabled={disabled}
              onChange={(event) => {
                const endMs = dateInputToEndMs(event.target.value)
                onChange({ ...selection, customEndMs: endMs })
              }}
              className="w-full bg-white/[0.03]"
            />
          </div>
        </div>
      )}
    </div>
  )
}

export function useResolvedResearchPeriod(
  selection: ResearchPeriodSelection,
  nowMs?: number,
): { period: ResolvedResearchPeriod | null; error: string | null } {
  try {
    return { period: resolveResearchPeriod(selection, nowMs), error: null }
  } catch (error) {
    return {
      period: null,
      error: error instanceof Error ? error.message : 'Invalid research period',
    }
  }
}

export function defaultResearchPeriodSelection(): ResearchPeriodSelection {
  return { preset: DEFAULT_RESEARCH_PERIOD_PRESET }
}
