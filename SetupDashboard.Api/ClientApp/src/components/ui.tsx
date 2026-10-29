import type { ReactNode } from 'react'
import { ActionIcon, Badge, Button, Checkbox, Group, Loader, NumberInput, Paper, Select, Text as MText, TextInput, Title, type MantineColor } from '@mantine/core'
import { X } from 'lucide-react'
import type { RowStatus, StepStatus } from '../lib/api'

// Small form kit on Mantine and the DFRNT theme. A field marked `required` is one the owning
// app (Settings / Routed Ops) rejects without; the dashboard never fills it in for you.

/** A required field that's still empty: the warning tone, not the error red - it's not wrong yet. */
const missingStyles = {
  input: {
    borderColor: 'var(--mantine-color-orange-filled)',
    backgroundColor: 'var(--mantine-color-yellow-light)',
  },
}

export function Card({ title, children, right }: { title?: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <Paper component="section" p="lg">
      {(title || right) && (
        <Group justify="space-between" align="center" mb="sm">
          {title && <Title order={3} fz="sm" fw={700}>{title}</Title>}
          {right}
        </Group>
      )}
      {children}
    </Paper>
  )
}

export function Label({ text, required, hint }: { text: string; required?: boolean; hint?: string }) {
  return (
    <MText component="span" display="block" fz={11} fw={600} tt="uppercase" lts={0.5} c="dimmed" mb={4}>
      {text}{required && <MText component="span" inherit c="var(--mantine-color-red-text)" ml={2} title="Required by the app this is saved to">*</MText>}
      {hint && <MText component="span" inherit tt="none" lts={0} fw={400} c="dimmed" ml={4}>{hint}</MText>}
    </MText>
  )
}

export function Text({ label, value, onChange, required, placeholder, type = 'text', hint, autoComplete }: {
  label: string; value?: string; onChange: (v: string | undefined) => void; required?: boolean
  placeholder?: string; type?: string; hint?: string; autoComplete?: string
}) {
  return (
    <TextInput label={label} description={hint} withAsterisk={required} type={type} value={value ?? ''}
      placeholder={placeholder} autoComplete={autoComplete} size="sm"
      onChange={e => onChange(e.currentTarget.value === '' ? undefined : e.currentTarget.value)}
      styles={required && !value ? missingStyles : undefined} />
  )
}

export function Num({ label, value, onChange, required, step = 'any', hint }: {
  label: string; value?: number; onChange: (v: number | undefined) => void; required?: boolean; step?: string; hint?: string
}) {
  const whole = step === '1'
  return (
    <NumberInput label={label} description={hint} withAsterisk={required} value={value ?? ''} size="sm"
      allowDecimal={!whole} step={whole ? 1 : undefined} hideControls={!whole}
      onChange={v => onChange(v === '' || v == null ? undefined : Number(v))}
      styles={required && value == null ? missingStyles : undefined} />
  )
}

export function Pick({ label, value, onChange, options, required, placeholder = 'Choose…', loading, error }: {
  label: string; value?: number | string; onChange: (v: never) => void; required?: boolean
  options: { value: number | string; label: string }[]; placeholder?: string; loading?: boolean; error?: string | null
}) {
  // Mantine's Select works in strings; the caller's ids may be numbers, so map back on change.
  const data = options.map(o => ({ value: String(o.value), label: o.label }))
  return (
    <Select label={label} withAsterisk={required} data={data} size="sm" searchable={data.length > 8} clearable={!required}
      value={value == null || value === '' ? null : String(value)}
      placeholder={loading ? 'Loading…' : error ? 'Could not load' : placeholder}
      rightSection={loading ? <Loader size="xs" /> : undefined}
      error={error || undefined}
      onChange={raw => {
        const opt = options.find(o => String(o.value) === raw)
        ;(onChange as (v: unknown) => void)(raw == null ? undefined : opt ? opt.value : raw)
      }}
      styles={required && (value == null || value === '') ? missingStyles : undefined} />
  )
}

export function Check({ label, checked, onChange, warn }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; warn?: boolean }) {
  return (
    <Checkbox label={label} checked={checked} onChange={e => onChange(e.currentTarget.checked)} size="sm"
      styles={{ label: { fontSize: 'var(--mantine-font-size-xs)', color: warn && !checked ? 'var(--mantine-color-orange-text)' : 'var(--mantine-color-dimmed)' } }} />
  )
}

export function Btn({ children, onClick, kind = 'primary', disabled, title }: {
  children: ReactNode; onClick?: () => void; kind?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; title?: string
}) {
  const look = kind === 'primary' ? { variant: 'filled' } : kind === 'danger' ? { variant: 'light', color: 'red' } : { variant: 'default' }
  return <Button type="button" size="xs" title={title} onClick={onClick} disabled={disabled} {...look}>{children}</Button>
}

export function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <ActionIcon variant="subtle" color="red" size="sm" onClick={onClick} title="Remove" aria-label="Remove">
      <X size={14} strokeWidth={1.5} />
    </ActionIcon>
  )
}

function StatusBadge({ text, color }: { text: string; color: MantineColor }) {
  return <Badge variant="light" color={color} size="sm" tt="none" fw={600} style={{ whiteSpace: 'nowrap' }}>{text}</Badge>
}

const STEP_PILL: Record<StepStatus, [string, MantineColor]> = {
  not_started: ['Not started', 'gray'],
  waiting_on_tenant: ['Waiting on tenant', 'yellow'],
  in_progress: ['In progress', 'brand'],
  done: ['Done', 'green'],
}
export function StepPill({ status }: { status: StepStatus }) {
  const [text, color] = STEP_PILL[status] ?? STEP_PILL.not_started
  return <StatusBadge text={text} color={color} />
}

const ROW_PILL: Record<RowStatus, [string, MantineColor]> = {
  pending: ['Not sent', 'gray'],
  needs_data: ['Needs info', 'yellow'],
  created: ['Created', 'green'],
  failed: ['Failed', 'red'],
  skipped: ['Skipped', 'gray'],
  unknown: ['No answer', 'orange'],
}
export function RowPill({ status }: { status: RowStatus }) {
  const [text, color] = ROW_PILL[status] ?? ROW_PILL.pending
  return <StatusBadge text={text} color={color} />
}
