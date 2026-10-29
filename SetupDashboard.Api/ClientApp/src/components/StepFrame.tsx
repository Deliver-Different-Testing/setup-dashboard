import { useState, type ReactNode } from 'react'
import { useStore } from '../store'
import type { StepKey } from '../lib/api'
import { Btn, Card, RowPill, StepPill } from './ui'
import { errorMessage } from '../lib/helpers'

/** The store shows a failed action's message on the step; nothing else needs the rejection. */
const quiet = (p: Promise<unknown>) => { p.catch(() => { /* shown on the step */ }) }

interface Props {
  step: StepKey
  title: string
  intro: ReactNode
  /** Where saved rows are sent, e.g. "Settings". Omit for checklist-only steps. */
  sendsTo?: string
  /** The step's edited data, saved as-is. Omit for steps with no data of their own. */
  draft?: unknown
  dirty?: boolean
  onSaved?: () => void
  children?: ReactNode
}

export function StepFrame({ step, title, intro, sendsTo, draft, dirty, onSaved, children }: Props) {
  const session = useStore(s => s.session)
  const me = useStore(s => s.me)
  const busy = useStore(s => s.busy[step])
  const error = useStore(s => s.errors[step])
  const lastPush = useStore(s => s.lastPush[step])
  const { saveStep, sendStep, complete, reopen } = useStore()
  const [completeMsg, setCompleteMsg] = useState<string | null>(null)

  if (!session) return null
  const state = session.steps[step]
  const isDf = me?.isDfAdmin === true

  const save = async () => {
    if (draft === undefined) return true
    const ok = await saveStep(step, draft)
    if (ok) onSaved?.()
    return ok
  }
  const saveAndSend = async () => { if (await save()) await sendStep(step) }
  const markDone = async () => {
    setCompleteMsg(null)
    try { await complete(step) } catch (e: unknown) { setCompleteMsg(errorMessage(e, 'Not yet')) }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-ink">{title}</h2>
            <StepPill status={state.status} />
          </div>
          <div className="text-sm text-dimmed mt-1 max-w-3xl">{intro}</div>
          {state.status === 'done' && state.completedBy && (
            <p className="text-xs text-ok mt-1">Marked done by {state.completedBy}{state.completedAt ? ` on ${new Date(state.completedAt).toLocaleDateString()}` : ''}.</p>
          )}
        </div>
      </div>

      <Requests step={step} />
      <Checklist step={step} isDf={isDf} />

      {children}

      {error && <div className="px-4 py-2 rounded-lg bg-danger-light border border-danger/40 text-danger text-xs">{error}</div>}
      {lastPush && (
        <div className="px-4 py-2 rounded-lg bg-surface border border-line text-xs text-dimmed">
          Last send: <b className="text-ok">{lastPush.created} created</b>
          {lastPush.needsData > 0 && <>, <b className="text-warn">{lastPush.needsData} need info</b></>}
          {lastPush.failed > 0 && <>, <b className="text-danger">{lastPush.failed} failed</b></>}
          {lastPush.signInExpired && <> - <b>your sign-in expired; refresh the page and send again.</b></>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {draft !== undefined && <Btn kind="ghost" onClick={save} disabled={!!busy || !dirty}>{busy === 'saving' ? 'Saving…' : dirty ? 'Save' : 'Saved'}</Btn>}
        {sendsTo && (
          <Btn onClick={saveAndSend} disabled={!!busy}
            title={`Creates each complete row in ${sendsTo} as you. Rows missing required details are held back.`}>
            {busy === 'sending' ? `Sending to ${sendsTo}…` : `Save & send to ${sendsTo}`}
          </Btn>
        )}
        {state.status !== 'done'
          ? <Btn kind="ghost" onClick={markDone} disabled={!!busy || dirty}>Mark step done</Btn>
          : isDf && <Btn kind="ghost" onClick={() => quiet(reopen(step))} disabled={!!busy}>Reopen</Btn>}
        {completeMsg && <span className="text-xs text-warn">{completeMsg}</span>}
      </div>

      <RowResults step={step} />
    </div>
  )
}

function Requests({ step }: { step: StepKey }) {
  const session = useStore(s => s.session)!
  const me = useStore(s => s.me)
  const { addRequest, fulfilRequest } = useStore()
  const [item, setItem] = useState('')
  const [due, setDue] = useState('')
  const [now] = useState(() => Date.now())
  const reqs = session.steps[step].requests
  const open = reqs.filter(r => !r.fulfilledAt)

  if (reqs.length === 0 && !me?.isDfAdmin) return null
  return (
    <Card title={open.length > 0 ? `Waiting on ${session.business.companyName || 'the tenant'} (${open.length})` : 'Requests to the tenant'}>
      {reqs.length === 0 && <p className="text-xs text-dimmed">Nothing asked for yet.</p>}
      <ul className="space-y-1.5">
        {reqs.map(r => {
          const days = Math.max(0, Math.floor((now - new Date(r.requestedAt).getTime()) / 86400000))
          return (
            <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
              <span className={r.fulfilledAt ? 'line-through text-dimmed' : 'text-ink'}>
                {r.item}
                <span className="text-[11px] text-dimmed ml-2">
                  asked {days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} ago`}{r.requestedBy ? ` by ${r.requestedBy}` : ''}
                  {r.dueBy ? ` · due ${new Date(r.dueBy).toLocaleDateString()}` : ''}
                  {r.fulfilledAt ? ` · supplied${r.fulfilledBy ? ` by ${r.fulfilledBy}` : ''}` : ''}
                </span>
              </span>
              {!r.fulfilledAt && <Btn kind="ghost" onClick={() => quiet(fulfilRequest(step, r.id))}>Supplied</Btn>}
            </li>
          )
        })}
      </ul>
      {me?.isDfAdmin && (
        <div className="flex gap-2 mt-3">
          <input value={item} onChange={e => setItem(e.target.value)} placeholder="Ask the tenant for… (e.g. customer list with addresses)"
            className="flex-1 px-3 py-2 rounded-lg border border-line text-sm focus:outline-none focus:border-brand" />
          <input type="date" value={due} onChange={e => setDue(e.target.value)} className="px-3 py-2 rounded-lg border border-line text-sm" />
          <Btn onClick={async () => { if (item.trim()) { try { await addRequest(step, item.trim(), due || undefined); setItem(''); setDue('') } catch { /* shown on the step */ } } }} disabled={!item.trim()}>Ask</Btn>
        </div>
      )}
    </Card>
  )
}

function Checklist({ step, isDf }: { step: StepKey; isDf: boolean }) {
  const session = useStore(s => s.session)!
  const { tick } = useStore()
  const items = session.steps[step].checklist
  if (items.length === 0) return null
  return (
    <Card title="Checklist">
      <ul className="space-y-2">
        {items.map(c => {
          const canTick = c.owner !== 'DFRNT' || isDf
          return (
            <li key={c.id} className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={!!c.doneAt} disabled={!canTick} onChange={e => quiet(tick(step, c.id, e.target.checked))}
                className="mt-1 accent-brand" title={canTick ? '' : 'DFRNT ticks this one'} />
              <div className="flex-1">
                <span className={c.doneAt ? 'text-dimmed' : 'text-ink'}>{c.item}</span>
                <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-dimmed">{c.owner}{c.required ? ' · required' : ''}</span>
                {c.link && <a href={c.link} target="_blank" rel="noreferrer" className="ml-2 text-xs text-brand-text hover:underline">Open ↗</a>}
                {c.doneAt && <span className="block text-[11px] text-dimmed">Done {new Date(c.doneAt).toLocaleDateString()}{c.doneBy ? ` by ${c.doneBy}` : ''}</span>}
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function RowResults({ step }: { step: StepKey }) {
  const rows = useStore(s => s.session?.steps[step].rows ?? [])
  const retryRow = useStore(s => s.retryRow)
  const busy = useStore(s => s.busy[step])
  if (rows.length === 0) return null
  const order = { unknown: 0, failed: 1, needs_data: 2, pending: 3, skipped: 4, created: 5 } as const
  const sorted = [...rows].sort((a, b) => order[a.status] - order[b.status])
  return (
    <Card title="What happened to each record">
      <table className="w-full text-xs">
        <tbody>
          {sorted.map(r => (
            <tr key={`${r.kind}:${r.key}`} className="border-t border-line align-top">
              <td className="py-1.5 pr-2 text-dimmed whitespace-nowrap">{r.kind}</td>
              <td className="py-1.5 pr-2 font-medium text-ink">{r.key}</td>
              <td className="py-1.5 pr-2"><RowPill status={r.status} /></td>
              <td className="py-1.5 text-dimmed">
                {r.needs.length > 0 && <span className="text-warn">Needs: {r.needs.join(' · ')}</span>}
                {r.errors.length > 0 && <span className="text-danger">{r.errors.join(' ')}</span>}
                {r.notice && <span className="text-dimmed">{r.notice}</span>}
                {r.status === 'unknown' && (
                  <Btn kind="ghost" disabled={!!busy} onClick={() => quiet(retryRow(step, r.kind, r.key))}
                    title="Only once you've checked it isn't there - otherwise it would be created twice.">
                    It isn't there - send again
                  </Btn>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
