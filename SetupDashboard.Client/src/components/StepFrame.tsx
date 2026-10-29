import { useState, type ReactNode } from 'react'
import { Alert, Box, Checkbox, Group, Paper, Stack, Table, Text, TextInput, Title } from '@mantine/core'
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
    try { await complete(step) } catch (e: unknown) { setCompleteMsg(errorMessage(e, 'Could not mark this step done. Try again.')) }
  }

  return (
    <Stack maw={1024} mx="auto" gap="md">
      <Box>
        <Group gap="sm" align="center">
          <Title order={2} fz={24} fw={700}>{title}</Title>
          <StepPill status={state.status} />
        </Group>
        <Text size="sm" c="dimmed" mt={4} maw={768} component="div">{intro}</Text>
        {state.status === 'done' && state.completedBy && (
          <Text size="xs" c="var(--mantine-color-green-text)" mt={4}>Marked as done by {state.completedBy}{state.completedAt ? ` on ${new Date(state.completedAt).toLocaleDateString()}` : ''}.</Text>
        )}
      </Box>

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
          ? <Btn kind="ghost" onClick={markDone} disabled={!!busy || dirty}>Mark as done</Btn>
          : isDf && <Btn kind="ghost" onClick={() => quiet(reopen(step))} disabled={!!busy}>Reopen</Btn>}
        {completeMsg && <Text size="xs" c="var(--mantine-color-orange-text)">{completeMsg}</Text>}
      </Group>

      <RowResults step={step} />
    </Stack>
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
  const items = session.steps[step].checklist
  if (items.length === 0) return null
  return (
    <Card title="Checklist">
      <Stack gap="xs">
        {items.map(c => {
          const canTick = c.owner !== 'DFRNT' || isDf
          return (
            <Group key={c.id} align="flex-start" gap="sm" wrap="nowrap">
              <Checkbox size="xs" mt={3} checked={!!c.doneAt} disabled={!canTick} onChange={e => quiet(tick(step, c.id, e.currentTarget.checked))}
                title={canTick ? '' : 'Only DFRNT can tick this item'} aria-label={c.item} />
              <Box style={{ flex: 1 }}>
                <Text span size="sm" c={c.doneAt ? 'dimmed' : undefined}>{c.item}</Text>
                <Text span fz={10} fw={600} tt="uppercase" lts={0.5} c="dimmed" ml="xs">{c.owner}{c.required ? ' · required' : ''}</Text>
                {c.link && <Text component="a" href={c.link} target="_blank" rel="noreferrer" size="xs" c="var(--mantine-color-brand-text)" ml="xs">Open link</Text>}
                {c.doneAt && <Text fz={11} c="dimmed">Done on {new Date(c.doneAt).toLocaleDateString()}{c.doneBy ? ` by ${c.doneBy}` : ''}</Text>}
              </Box>
            </Group>
          )
        })}
      </Stack>
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
      <Table fz="xs" verticalSpacing={6} withRowBorders>
        <Table.Tbody>
          {sorted.map(r => (
            <Table.Tr key={`${r.kind}:${r.key}`} style={{ verticalAlign: 'top' }}>
              <Table.Td c="dimmed" style={{ whiteSpace: 'nowrap' }}>{r.kind}</Table.Td>
              <Table.Td fw={500}>{r.key}</Table.Td>
              <Table.Td><RowPill status={r.status} /></Table.Td>
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
