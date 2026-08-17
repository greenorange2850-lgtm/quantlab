import { RotateCcw, Save } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Disclosure } from '@/components/ui/disclosure'
import { Input } from '@/components/ui/input'
import type {
  ParameterValue,
  PlaybookDefinition,
  PlaybookParameterSchema,
  PlaybookParameters,
} from '@/core/playbook'
import { validateParameters } from '@/core/playbook'
import { cn } from '@/lib/utils'

interface ConfigurePanelProps {
  definition: PlaybookDefinition
  draft: PlaybookParameters
  dirty: boolean
  onChange: (key: string, value: ParameterValue) => void
  onReset: () => void
  onApply: () => void
}

export function ConfigurePanel({
  definition,
  draft,
  dirty,
  onChange,
  onReset,
  onApply,
}: ConfigurePanelProps) {
  const issues = validateParameters(definition, draft)
  const required = definition.parameterSchema.filter((p) => p.group === 'required')
  const optional = definition.parameterSchema.filter((p) => p.group === 'optional')

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>Configure</CardTitle>
        {dirty ? (
          <Badge variant="warning">Unsaved changes</Badge>
        ) : (
          <Badge variant="outline">Applied</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <Disclosure title="Required parameters" defaultOpen>
          <div className="space-y-3">
            {required.map((p) => (
              <ParameterField
                key={p.key}
                schema={p}
                value={draft[p.key]}
                onChange={onChange}
              />
            ))}
          </div>
        </Disclosure>

        <Disclosure title="Optional / confluences">
          <div className="space-y-3">
            {optional.map((p) => (
              <ParameterField
                key={p.key}
                schema={p}
                value={draft[p.key]}
                onChange={onChange}
              />
            ))}
          </div>
        </Disclosure>

        {issues.length > 0 && (
          <div className="space-y-1 rounded-lg border border-danger/20 bg-danger-muted px-3 py-2">
            {issues.map((i) => (
              <p key={i.key} className="text-[11px] text-danger">
                {i.message}
              </p>
            ))}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onReset} disabled={!dirty}>
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
          <Button size="sm" onClick={onApply} disabled={!dirty || issues.length > 0}>
            <Save className="h-3.5 w-3.5" />
            Apply
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

interface ParameterFieldProps {
  schema: PlaybookParameterSchema
  value: ParameterValue | undefined
  onChange: (key: string, value: ParameterValue) => void
}

function ParameterField({ schema, value, onChange }: ParameterFieldProps) {
  const current = value ?? schema.default

  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground">{schema.label}</span>
        {schema.description && (
          <span className="truncate text-[10px] text-muted-foreground" title={schema.description}>
            {schema.description}
          </span>
        )}
      </div>
      {schema.type === 'boolean' ? (
        <BooleanToggle checked={Boolean(current)} onChange={(v) => onChange(schema.key, v)} />
      ) : schema.type === 'select' ? (
        <select
          className={cn(
            'flex h-9 w-full rounded-lg border border-border bg-white/5 px-3 py-1 text-sm text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
          )}
          value={String(current)}
          onChange={(e) => onChange(schema.key, e.target.value)}
        >
          {(schema.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <Input
          type="number"
          value={Number(current)}
          min={schema.min}
          max={schema.max}
          step={schema.step}
          onChange={(e) => {
            const raw = e.target.value
            if (raw === '') return
            onChange(schema.key, Number(raw))
          }}
        />
      )}
    </label>
  )
}

function BooleanToggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex h-6 w-11 items-center rounded-full border px-0.5 transition-colors',
        checked ? 'justify-end border-accent/40 bg-accent/25' : 'justify-start border-border bg-white/5',
      )}
    >
      <span
        className={cn(
          'h-5 w-5 rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-muted-foreground/50',
        )}
      />
    </button>
  )
}
