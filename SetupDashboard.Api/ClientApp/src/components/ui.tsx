import type { ReactNode } from 'react'
import type { RowStatus, StepStatus } from '../lib/api'

// Small form kit. A field marked `required` is one the owning app (Settings / Routed Ops)
// rejects without; the dashboard never fills it in for you.

export function Card({ title, children, right }: { title?: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      {(title || right) && (
        <div className="flex items-center justify-between mb-3">
          {title && <h3 className="text-sm font-bold text-navy">{title}</h3>}
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

export function Label({ text, required, hint }: { text: string; required?: boolean; hint?: string }) {
  return (
    <span className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">
      {text}{required && <span className="text-red-500 ml-0.5" title="Required by the app this is saved to">*</span>}
      {hint && <span className="normal-case tracking-normal font-normal text-gray-400 ml-1">{hint}</span>}
    </span>
  )
}

const inputCls = (missing?: boolean) =>
  `w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:border-cyan ${missing ? 'border-amber-300 bg-amber-50/40' : 'border-gray-200'}`

export function Text({ label, value, onChange, required, placeholder, type = 'text', hint, autoComplete }: {
  label: string; value?: string; onChange: (v: string | undefined) => void; required?: boolean
  placeholder?: string; type?: string; hint?: string; autoComplete?: string
}) {
  return (
    <label className="block">
      <Label text={label} required={required} hint={hint} />
      <input type={type} value={value ?? ''} placeholder={placeholder} autoComplete={autoComplete}
        onChange={e => onChange(e.target.value === '' ? undefined : e.target.value)}
        className={inputCls(required && !value)} />
    </label>
  )
}

export function Num({ label, value, onChange, required, step = 'any', hint }: {
  label: string; value?: number; onChange: (v: number | undefined) => void; required?: boolean; step?: string; hint?: string
}) {
  return (
    <label className="block">
      <Label text={label} required={required} hint={hint} />
      <input type="number" step={step} value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        className={inputCls(required && value == null)} />
    </label>
  )
}

export function Pick({ label, value, onChange, options, required, placeholder = 'Choose…', loading, error }: {
  label: string; value?: number | string; onChange: (v: never) => void; required?: boolean
  options: { value: number | string; label: string }[]; placeholder?: string; loading?: boolean; error?: string | null
}) {
  return (
    <label className="block">
      <Label text={label} required={required} />
      <select value={value ?? ''} onChange={e => {
        const raw = e.target.value
        const opt = options.find(o => String(o.value) === raw)
        ;(onChange as (v: unknown) => void)(raw === '' ? undefined : opt ? opt.value : raw)
      }} className={inputCls(required && (value == null || value === ''))}>
        <option value="">{loading ? 'Loading…' : error ? 'Could not load' : placeholder}</option>
        {options.map(o => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
      </select>
      {error && <span className="text-[11px] text-red-500">{error}</span>}
    </label>
  )
}

export function Check({ label, checked, onChange, warn }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; warn?: boolean }) {
  return (
    <label className={`flex items-start gap-2 text-xs cursor-pointer ${warn && !checked ? 'text-amber-700' : 'text-gray-600'}`}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="mt-0.5 accent-cyan" />
      <span>{label}</span>
    </label>
  )
}

export function Btn({ children, onClick, kind = 'primary', disabled, title }: {
  children: ReactNode; onClick?: () => void; kind?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; title?: string
}) {
  const cls = kind === 'primary'
    ? 'bg-cyan text-white hover:bg-cyan-dark shadow-sm'
    : kind === 'danger' ? 'border border-red-200 text-red-600 hover:bg-red-50' : 'border border-gray-300 text-gray-600 hover:border-navy hover:text-navy'
  return <button type="button" title={title} onClick={onClick} disabled={disabled}
    className={`px-4 py-2 rounded-full text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${cls}`}>{children}</button>
}

export function RemoveBtn({ onClick }: { onClick: () => void }) {
  return <button type="button" onClick={onClick} className="text-gray-300 hover:text-red-500 text-sm px-1" title="Remove">✕</button>
}

const STEP_PILL: Record<StepStatus, [string, string]> = {
  not_started: ['Not started', 'bg-gray-100 text-gray-500'],
  waiting_on_tenant: ['Waiting on tenant', 'bg-amber-100 text-amber-700'],
  in_progress: ['In progress', 'bg-cyan/15 text-cyan-dark'],
  done: ['Done', 'bg-green-100 text-green-700'],
}
export function StepPill({ status }: { status: StepStatus }) {
  const [text, cls] = STEP_PILL[status] ?? STEP_PILL.not_started
  return <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>{text}</span>
}

const ROW_PILL: Record<RowStatus, [string, string]> = {
  pending: ['Not sent', 'bg-gray-100 text-gray-500'],
  needs_data: ['Needs info', 'bg-amber-100 text-amber-700'],
  created: ['Created', 'bg-green-100 text-green-700'],
  failed: ['Failed', 'bg-red-100 text-red-600'],
  skipped: ['Skipped', 'bg-gray-100 text-gray-500'],
}
export function RowPill({ status }: { status: RowStatus }) {
  const [text, cls] = ROW_PILL[status] ?? ROW_PILL.pending
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${cls}`}>{text}</span>
}

