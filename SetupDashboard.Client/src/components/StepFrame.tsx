import { useState, type ReactNode } from 'react'
import { Alert, Box, Checkbox, Group, Paper, Stack, Table, Text, TextInput, Title, Tooltip } from '@mantine/core'
import { useStore } from '../store'
import type { Elsewhere, StepKey } from '../lib/api'
import { Btn, Card, RowPill, StepPill } from './ui'
import { errorMessage } from '../lib/helpers'
import { ALREADY_IN_DFRNT, canMarkElsewhere, doneLine, isElsewhere } from '../lib/doneAnotherWay'
import { stripText } from '../lib/alreadyInDfrnt'
import { DoneAnotherWayDialog } from './DoneAnotherWayDialog'

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
  /** Throws away unsaved edits (when the step is marked done another way). */
  onDiscard?: () => void
  children?: ReactNode
}

export function StepFrame({ step, title, intro, sendsTo, draft, dirty, onSaved, onDiscard, children }: Props) {
  const session = useStore(s => s.session)
  const me = useStore(s => s.me)
  const busy = useStore(s => s.busy[step])
  const error = useStore(s => s.errors[step])
  const lastPush = useStore(s => s.lastPush[step])
  const { saveStep, sendStep, complete, reopen } = useStore()
  const [completeMsg, setCompleteMsg] = useState<string | null>(null)
  const elsewhereOpen = useStore(s => s.elsewhereDialog?.step === step ? s.elsewhereDialog : null)
  const { openElsewhere, closeElsewhere } = useStore()

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
    try { await complete(step) } catch (e: unknown) { setCompleteMsg(errorMessage(e, 'Could not mark this step done. Try again.')) }
  }
  // Errors are shown in the dialog, so this rethrows instead of using the store's step error.
  const markElsewhere = async (e: Elsewhere) => {
    setCompleteMsg(null)
    await complete(step, e)
    onDiscard?.()
  }

  return (
    <Stack maw={1024} mx="auto" gap="md">
      <Box>
        <Group gap="sm" align="center">
          <Title order={2} fz={24} fw={700}>{title}</Title>
          <StepPill status={state.status} elsewhere={isElsewhere(state)} />
        </Group>
        <Text size="sm" c="dimmed" mt={4} maw={768} component="div">{intro}</Text>
        {state.status === 'done' && (state.completedBy || isElsewhere(state)) && (
          <Text size="xs" c="var(--mantine-color-green-text)" mt={4}>{doneLine(state)}</Text>
        )}
      </Box>

      <AlreadyInDfrnt step={step} />
      <Requests step={step} />
      <Checklist step={step} isDf={isDf} />

      {children}

      {error && <Alert variant="light" color="red" py="xs" px="md" fz="xs">{error}</Alert>}
      {lastPush && (
        <Paper withBorder px="md" py="xs">
          <Text size="xs" c="dimmed">
            Last send to {sendsTo ?? 'Settings'}: <Text span inherit fw={700} c="var(--mantine-color-green-text)">{lastPush.created} created</Text>
            {lastPush.needsData > 0 && <>, <Text span inherit fw={700} c="var(--mantine-color-orange-text)">{lastPush.needsData} missing details</Text></>}
            {lastPush.failed > 0 && <>, <Text span inherit fw={700} c="var(--mantine-color-red-text)">{lastPush.failed} failed</Text></>}
            {lastPush.signInExpired && <>. <Text span inherit fw={700}>Your sign-in has expired. Refresh the page, then send again.</Text></>}
          </Text>
        </Paper>
      )}

      <Group gap="xs" align="center">
        {draft !== undefined && <Btn kind="ghost" onClick={save} disabled={!!busy || !dirty}>{busy === 'saving' ? 'Saving…' : dirty ? 'Save changes' : 'Saved'}</Btn>}
        {sendsTo && (
          <Btn onClick={saveAndSend} disabled={!!busy}
            title={`Creates each complete row in ${sendsTo} as you. Rows missing required details are held back.`}>
            {busy === 'sending' ? `Sending to ${sendsTo}…` : `Save and send to ${sendsTo}`}
          </Btn>
        )}
        {state.status !== 'done'
          ? <>
              <Btn kind="ghost" onClick={markDone} disabled={!!busy || dirty} title={dirty ? 'Save your changes first.' : undefined}>Mark as done</Btn>
              {canMarkElsewhere(me) && (
                <Btn kind="ghost" onClick={() => openElsewhere(step)} disabled={!!busy}
                  title="The work was done outside this dashboard (Settings, Admin Manager, Claude). Add a note saying how.">
                  Done another way…
                </Btn>
              )}
            </>
          : isDf && <Btn kind="ghost" onClick={() => quiet(reopen(step))} disabled={!!busy}>Reopen</Btn>}
        {completeMsg && <Text size="xs" c="var(--mantine-color-orange-text)">{completeMsg}</Text>}
      </Group>

      <RowResults step={step} />
      {elsewhereOpen && (
        <DoneAnotherWayDialog stepTitle={title} dirty={dirty} initial={elsewhereOpen.initial} onSubmit={markElsewhere} onClose={closeElsewhere} />
      )}
    </Stack>
  )
}

/** What the tenant already has for this step, with a shortcut to mark it done another way. */
function AlreadyInDfrnt({ step }: { step: StepKey }) {
  const summary = useStore(s => s.tenantSummary)
  const me = useStore(s => s.me)
  const status = useStore(s => s.session?.steps[step].status)
  const openElsewhere = useStore(s => s.openElsewhere)
  const text = summary && stripText(step, summary)
  if (!text) return null
  return (
    <Paper withBorder px="md" py="xs">
      <Group justify="space-between" gap="sm" wrap="nowrap">
        <Text size="xs"><Text span inherit fw={700}>Already in DFRNT: </Text>{text}</Text>
        {status !== 'done' && canMarkElsewhere(me) && (
          <Btn kind="ghost" onClick={() => openElsewhere(step, { method: ALREADY_IN_DFRNT, note: text })}>Done another way…</Btn>
        )}
      </Group>
    </Paper>
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
      {reqs.length === 0 && <Text size="xs" c="dimmed">No requests yet. Ask the tenant for anything you need below.</Text>}
      <Stack gap={6}>
        {reqs.map(r => {
          const days = Math.max(0, Math.floor((now - new Date(r.requestedAt).getTime()) / 86400000))
          return (
            <Group key={r.id} justify="space-between" align="center" gap="sm" wrap="nowrap">
              <Text size="sm" td={r.fulfilledAt ? 'line-through' : undefined} c={r.fulfilledAt ? 'dimmed' : undefined}>
                {r.item}
                <Text span fz={11} c="dimmed" ml="xs">
                  Asked {days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} ago`}{r.requestedBy ? ` by ${r.requestedBy}` : ''}
                  {r.dueBy ? ` · due ${new Date(r.dueBy).toLocaleDateString()}` : ''}
                  {r.fulfilledAt ? ` · supplied${r.fulfilledBy ? ` by ${r.fulfilledBy}` : ''}` : ''}
                </Text>
              </Text>
              {!r.fulfilledAt && <Btn kind="ghost" onClick={() => quiet(fulfilRequest(step, r.id))}>Mark supplied</Btn>}
            </Group>
          )
        })}
      </Stack>
      {me?.isDfAdmin && (
        <Group gap="xs" mt="sm" wrap="nowrap">
          <TextInput style={{ flex: 1 }} size="sm" value={item} onChange={e => setItem(e.currentTarget.value)} aria-label="Request for the tenant"
            placeholder="Ask the tenant for… (e.g. customer list with addresses)" />
          <TextInput size="sm" type="date" value={due} onChange={e => setDue(e.currentTarget.value)} aria-label="Due date (optional)" />
          <Btn onClick={async () => { if (item.trim()) { try { await addRequest(step, item.trim(), due || undefined); setItem(''); setDue('') } catch { /* shown on the step */ } } }} disabled={!item.trim()}>Send request</Btn>
        </Group>
      )}
    </Card>
  )
}

function Checklist({ step, isDf }: { step: StepKey; isDf: boolean }) {
  const session = useStore(s => s.session)!
  const { tick } = useStore()
  const seedLooksDone = useStore(s => s.tenantSummary?.seedLooksDone === true)
  // The item just ticked offers "How? (optional)"; any done item's note can be edited later.
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const items = session.steps[step].checklist
  const covered = isElsewhere(session.steps[step])
  if (items.length === 0) return null
  return (
    <Card title="Checklist">
      <Stack gap="xs">
        {items.map(c => {
          const canTick = c.owner !== 'DFRNT' || isDf
          return (
            <Group key={c.id} align="flex-start" gap="sm" wrap="nowrap">
              <Checkbox size="xs" mt={3} checked={!!c.doneAt} disabled={!canTick} onChange={e => { const on = e.currentTarget.checked; setNoteFor(on ? c.id : null); quiet(tick(step, c.id, on)) }}
                title={canTick ? '' : 'Only DFRNT can tick this item'} aria-label={c.item} />
              <Box style={{ flex: 1 }}>
                <Text span size="sm" c={c.doneAt ? 'dimmed' : undefined}>{c.item}</Text>
                <Text span fz={10} fw={600} tt="uppercase" lts={0.5} c="dimmed" ml="xs">{c.owner}{c.required ? ' · required' : ''}</Text>
                {c.link && <Text component="a" href={c.link} target="_blank" rel="noreferrer" size="xs" c="var(--mantine-color-brand-text)" ml="xs">Open link</Text>}
                {c.doneAt && (
                  <Text fz={11} c="dimmed">
                    Done on {new Date(c.doneAt).toLocaleDateString()}{c.doneBy ? ` by ${c.doneBy}` : ''}{c.note ? `: ${c.note}` : ''}
                    {canTick && noteFor !== c.id && (
                      <Text component="button" type="button" fz={11} c="var(--mantine-color-brand-text)" ml="xs" bd={0} bg="none" p={0}
                        style={{ cursor: 'pointer' }} onClick={() => setNoteFor(c.id)}>
                        {c.note ? 'Edit note' : 'Add a note'}
                      </Text>
                    )}
                  </Text>
                )}
                {c.doneAt && canTick && noteFor === c.id && (
                  <ChecklistNote initial={c.note ?? ''} onSave={note => { setNoteFor(null); quiet(tick(step, c.id, true, note)) }} onCancel={() => setNoteFor(null)} />
                )}
                {!c.doneAt && c.required && covered && <Text fz={11} c="dimmed">Covered by the step note</Text>}
                {!c.doneAt && c.id === SEED_ITEM && seedLooksDone && (
                  <Group gap="xs" mt={4}>
                    <Text fz={11} c="var(--mantine-color-green-text)">Looks seeded: the tenant client file exists and System Settings no longer name Urgent.</Text>
                    {canTick && <Btn kind="ghost" onClick={() => quiet(tick(step, c.id, true, 'Confirmed from what is in the tenant'))}>Confirm</Btn>}
                  </Group>
                )}
              </Box>
            </Group>
          )
        })}
      </Stack>
    </Card>
  )
}

/** StepCatalog.TenantIdentitySeed: suggested from the tenant summary, confirmed by a person. */
const SEED_ITEM = 'tenant-identity-seed'

function ChecklistNote({ initial, onSave, onCancel }: { initial: string; onSave: (note: string) => void; onCancel: () => void }) {
  const [note, setNote] = useState(initial)
  return (
    <Group gap="xs" mt={4} wrap="nowrap">
      <TextInput style={{ flex: 1 }} size="xs" value={note} maxLength={500} placeholder="How? (optional) e.g. made by hand in Admin Manager"
        aria-label="How was it done? (optional)" autoFocus
        onChange={e => setNote(e.currentTarget.value)}
        onKeyDown={e => { if (e.key === 'Enter') onSave(note.trim()); if (e.key === 'Escape') onCancel() }} />
      <Btn kind="ghost" onClick={() => onSave(note.trim())}>Save note</Btn>
      <Btn kind="ghost" onClick={onCancel}>Skip</Btn>
    </Group>
  )
}

function RowResults({ step }: { step: StepKey }) {
  const rows = useStore(s => s.session?.steps[step].rows ?? [])
  const note = useStore(s => s.session?.steps[step].completedNote)
  const retryRow = useStore(s => s.retryRow)
  const busy = useStore(s => s.busy[step])
  if (rows.length === 0) return null
  const order = { unknown: 0, failed: 1, needs_data: 2, pending: 3, skipped: 4, created: 5 } as const
  const sorted = [...rows].sort((a, b) => order[a.status] - order[b.status])
  return (
    <Card title="What happened to each record">
      <Table fz="xs" verticalSpacing={6} withRowBorders>
        <Table.Tbody>
          {sorted.map(r => (
            <Table.Tr key={`${r.kind}:${r.key}`} style={{ verticalAlign: 'top' }}>
              <Table.Td c="dimmed" style={{ whiteSpace: 'nowrap' }}>{r.kind}</Table.Td>
              <Table.Td fw={500}>{r.key}</Table.Td>
              <Table.Td>
                {r.status === 'skipped' && note
                  ? <Tooltip label={note} multiline maw={320} withArrow><span><RowPill status={r.status} /></span></Tooltip>
                  : <RowPill status={r.status} />}
              </Table.Td>
              <Table.Td c="dimmed">
                {r.needs.length > 0 && <Text span inherit c="var(--mantine-color-orange-text)">Needs: {r.needs.join(' · ')}</Text>}
                {r.errors.length > 0 && <Text span inherit c="var(--mantine-color-red-text)">{r.errors.join(' ')}</Text>}
                {r.notice && <Text span inherit c="dimmed">{r.notice}</Text>}
                {r.status === 'unknown' && (
                  <Btn kind="ghost" disabled={!!busy} onClick={() => quiet(retryRow(step, r.kind, r.key))}
                    title="Send again only after checking it isn't in Settings. Otherwise it is created twice.">
                    Not in Settings, send again
                  </Btn>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Card>
  )
}
