import { useState } from 'react'
import { Alert, Badge, Box, Collapse, Grid, Group, SegmentedControl, SimpleGrid, Stack, Text as MText, TextInput, UnstyledButton } from '@mantine/core'
import { ChevronDown, Search } from 'lucide-react'
import { useStore } from '../../store'
import type { ClientContactRow, ClientRow } from '../../lib/api'
import { StepFrame } from '../StepFrame'
import { SmartImport } from '../SmartImport'
import { useDraft } from '../useDraft'
import { Btn, Card, Check, Num, Pick, RemoveBtn, Text } from '../ui'
import { patchAt, removeAt, useLookup } from '../../lib/helpers'
import { applyToAll, clientMatches, clientNeeds, type ApplyMode } from '../../lib/clients'

const Col = Grid.Col
const TOP = { borderTop: '1px solid var(--dd-outline-variant)' }
const INSET = { borderRadius: 'var(--mantine-radius-md)' }
const SECTION = { fz: 11, fw: 600, tt: 'uppercase', lts: 0.5, c: 'dimmed' } as const
/** Four-across on desktop, two on tablets, one on phones. */
const QUARTER = { base: 4, xs: 2, md: 1 }
const HALF = { base: 4, md: 2 }

type Opt = { value: number; label: string }
/** Settings returns { options, defaultId }; options are {id,name} or {value,label}. */
type RawOption = { id?: number; value?: number; name?: string; label?: string; description?: string }
type OptionsPayload = RawOption[] | { options?: RawOption[]; defaultId?: number }
function useOptions(name: string) {
  const res = useLookup<OptionsPayload>(name)
  const raw: RawOption[] = Array.isArray(res.data) ? res.data : res.data?.options ?? []
  const defaultId = Array.isArray(res.data) ? undefined : res.data?.defaultId
  const options: Opt[] = raw.filter(o => (o.id ?? o.value) != null).map(o => ({
    value: (o.id ?? o.value)!,
    label: `${o.name ?? o.label ?? o.description ?? o.id}${(o.id ?? o.value) === defaultId ? ' (tenant default)' : ''}`,
  }))
  return { options, defaultId, loading: res.loading, error: res.error }
}

const newClient = (): ClientRow => ({ inviteConfirmed: false, primaryContact: { createSignIn: false }, contacts: [] })
const newContact = (): ClientContactRow => ({ createSignIn: false })
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`

type Filter = 'all' | 'needs' | 'ready'

export function ClientsStep() {
  const me = useStore(s => s.me)
  const reload = useStore(s => s.reload)
  const { draft, setDraft, dirty, markSaved } = useDraft<ClientRow[]>(s => s.clients)
  const schedules = useOptions('invoice-schedules')
  const terms = useOptions('payment-terms')
  const [importing, setImporting] = useState<'clients' | 'contacts' | null>(null)
  const [open, setOpen] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [bulk, setBulk] = useState<{ scheduleId?: number; termId?: number; mode: ApplyMode }>({ mode: 'blanks' })
  const [undo, setUndo] = useState<{ message: string; prev: ClientRow[] } | null>(null)
  const us = me?.isUsTenant === true

  const needs = draft.map(c => clientNeeds(c, us))
  const needCount = needs.filter(n => n.length > 0).length
  const shown = draft.map((_, i) => i).filter(i =>
    clientMatches(draft[i], search) && (filter === 'all' || (filter === 'needs') === needs[i].length > 0))

  const patch = (i: number, p: Partial<ClientRow>) => setDraft(d => patchAt(d, i, p))
  /** A change the user may want back: remember the list before it and offer Undo. */
  const undoable = (message: string, next: ClientRow[]) => { setUndo({ message, prev: draft }); setDraft(next) }
  const toggle = (i: number) => setOpen(s => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n })

  const applyBulk = () => {
    const { rows, changed } = applyToAll(draft, { invoiceScheduleId: bulk.scheduleId, paymentTermId: bulk.termId }, bulk.mode)
    if (changed === 0) setUndo({ message: 'Every customer already has these values.', prev: draft })
    else undoable(`Applied to ${plural(changed, 'customer')}.`, rows)
  }
  const confirmAllInvites = () => {
    const { rows, changed } = applyToAll(draft, { inviteConfirmed: true }, 'all')
    if (changed > 0) undoable(`Confirmed the sign-in invite for ${plural(changed, 'customer')}.`, rows)
  }
  const removeClient = (i: number) => {
    undoable(`Removed ${draft[i].name || draft[i].code || 'customer'}.`, removeAt(draft, i))
    setOpen(new Set())
  }

  return (
    <StepFrame step="clients" title="Customers and booking contacts" sendsTo="Settings" draft={draft} dirty={dirty} onSaved={() => { markSaved(); setUndo(null) }}
      intro={<>
        Customers are created in Settings &gt; Clients &amp; Customers. Each needs a code, name, real address, invoice schedule,
        payment term and primary contact. Settings <b>emails the primary contact a booking sign-in</b> when it creates the customer.
        Add a map position here, or in Settings later, before using client-address schedules.
      </>}>
      <Card title={`Customers (${draft.length})`} right={<Stack gap={4} align="flex-end">
        <Group gap={8}>
          <Btn kind="ghost" disabled={dirty} onClick={() => setImporting('clients')}>Import customers</Btn>
          <Btn kind="ghost" disabled={dirty || draft.length === 0} onClick={() => setImporting('contacts')}>Import contacts</Btn>
          <Btn kind="ghost" onClick={() => { setDraft(d => [...d, newClient()]); setOpen(s => new Set(s).add(draft.length)) }}>Add customer</Btn>
        </Group>
        {dirty && <MText fz="xs" c="dimmed">Save your changes to import</MText>}
      </Stack>}>
        {draft.length === 0 && (
          <MText size="sm" c="dimmed" py="md">No customers yet. Import your customer spreadsheet, or add them one at a time.</MText>
        )}

        {draft.length > 0 && <>
          <Box mb="md" p="sm" bg="var(--dd-surface)" style={INSET}>
            <MText {...SECTION} mb={6}>Set for every customer</MText>
            <Grid columns={4} gutter={8} align="flex-end" overflow="visible">
              <Col span={QUARTER}><Pick label="Invoice schedule" value={bulk.scheduleId} options={schedules.options} loading={schedules.loading} error={schedules.error}
                onChange={v => setBulk(b => ({ ...b, scheduleId: v }))} placeholder="Leave unchanged" /></Col>
              <Col span={QUARTER}><Pick label="Payment term" value={bulk.termId} options={terms.options} loading={terms.loading} error={terms.error}
                onChange={v => setBulk(b => ({ ...b, termId: v }))} placeholder="Leave unchanged" /></Col>
              <Col span={QUARTER}>
                <SegmentedControl size="xs" fullWidth value={bulk.mode} onChange={v => setBulk(b => ({ ...b, mode: v as ApplyMode }))}
                  aria-label="Which customers to change"
                  data={[{ value: 'blanks', label: 'Only where empty' }, { value: 'all', label: 'Replace all' }]} />
              </Col>
              <Col span={QUARTER}>
                <Group gap={8} justify="flex-end">
                  <Btn kind="ghost" disabled={bulk.scheduleId == null && bulk.termId == null} onClick={applyBulk}>Apply</Btn>
                  <Btn kind="ghost" disabled={draft.every(c => c.inviteConfirmed)} onClick={confirmAllInvites}>Confirm all invites</Btn>
                </Group>
              </Col>
            </Grid>
          </Box>

          {undo && (
            <Alert variant="light" color="gray" mb="md" withCloseButton onClose={() => setUndo(null)} closeButtonLabel="Dismiss">
              <Group justify="space-between" gap={8}>
                <MText size="sm">{undo.message}</MText>
                {undo.prev !== draft && <Btn kind="ghost" onClick={() => { setDraft(undo.prev); setUndo(null); setOpen(new Set()) }}>Undo</Btn>}
              </Group>
            </Alert>
          )}

          <Group gap={8} mb="xs" wrap="wrap">
            <TextInput size="xs" style={{ flex: '1 1 220px' }} leftSection={<Search size={14} />} aria-label="Search customers"
              placeholder="Search by code, name or contact email" value={search} onChange={e => setSearch(e.currentTarget.value)} />
            <SegmentedControl size="xs" value={filter} onChange={v => setFilter(v as Filter)} aria-label="Show customers"
              data={[
                { value: 'all', label: `All ${draft.length}` },
                { value: 'needs', label: `Need details ${needCount}` },
                { value: 'ready', label: `Ready ${draft.length - needCount}` },
              ]} />
            <Btn kind="ghost" onClick={() => setOpen(new Set(shown))}>Expand all</Btn>
            <Btn kind="ghost" disabled={open.size === 0} onClick={() => setOpen(new Set())}>Collapse all</Btn>
          </Group>

          {shown.length === 0 && (
            <Group gap={8} py="md">
              <MText size="sm" c="dimmed">No customers match.</MText>
              <Btn kind="ghost" onClick={() => { setSearch(''); setFilter('all') }}>Show all customers</Btn>
            </Group>
          )}
        </>}

        <Box>
          {shown.map((i, n) => {
            const c = draft[i]
            const isOpen = open.has(i)
            const missing = needs[i]
            return (
              <Box key={i} py={8} style={n > 0 ? TOP : undefined}>
                <UnstyledButton type="button" onClick={() => toggle(i)} w="100%" aria-expanded={isOpen} aria-controls={`customer-${i}`}>
                  <Group justify="space-between" align="center" wrap="nowrap" gap="sm">
                    <Box style={{ minWidth: 0 }}>
                      <MText size="sm" fw={500} truncate>
                        {c.name || 'New customer'}
                        <MText span size="xs" c="dimmed" ml={8}>{c.code || 'No code'}</MText>
                      </MText>
                      <MText size="xs" c={missing.length ? 'var(--mantine-color-orange-text)' : 'dimmed'} truncate>
                        {missing.length
                          ? `Needs ${missing.join(', ')}`
                          : [[c.address, c.suburb, c.city].filter(Boolean).join(', '), c.primaryContact.email, c.contacts.length ? `+${plural(c.contacts.length, 'contact')}` : '']
                            .filter(Boolean).join('   ')}
                      </MText>
                    </Box>
                    <Group gap={8} wrap="nowrap">
                      <Badge variant="light" color={missing.length ? 'yellow' : 'green'} size="sm" tt="none" fw={600}>
                        {missing.length ? `${missing.length} to fill` : 'Ready'}
                      </Badge>
                      <ChevronDown size={16} aria-hidden style={{ transform: isOpen ? 'rotate(180deg)' : undefined, transition: 'transform 150ms' }} />
                    </Group>
                  </Group>
                </UnstyledButton>
                <Collapse in={isOpen} id={`customer-${i}`}>
                  <Stack gap="sm" mt="sm">
                    <Grid columns={4} gutter={8} align="flex-end" overflow="visible">
                      <Col span={QUARTER}><Text label="Client code" required value={c.code} onChange={v => patch(i, { code: v })} /></Col>
                      <Col span={HALF}><Text label="Name" required value={c.name} onChange={v => patch(i, { name: v })} /></Col>
                      <Col span={{ base: 4, xs: 2, md: 1 }}><Group justify="flex-end"><Btn kind="danger" onClick={() => removeClient(i)}>Remove customer</Btn></Group></Col>
                      <Col span={HALF}><Text label="Street address" required value={c.address} onChange={v => patch(i, { address: v })} /></Col>
                      <Col span={QUARTER}><Text label="Unit / suite" value={c.unit} onChange={v => patch(i, { unit: v })} /></Col>
                      <Col span={QUARTER}><Text label={us ? 'Zip code' : 'Post code'} value={c.postCode} onChange={v => patch(i, { postCode: v })} /></Col>
                      <Col span={QUARTER}><Text label={us ? 'City' : 'Suburb'} required value={c.suburb} onChange={v => patch(i, { suburb: v })} /></Col>
                      <Col span={QUARTER}><Text label={us ? 'State' : 'City'} required value={c.city} onChange={v => patch(i, { city: v })} /></Col>
                      <Col span={QUARTER}><Text label="Country" value={c.country} onChange={v => patch(i, { country: v })} /></Col>
                      <Col span={QUARTER}>
                        <SimpleGrid cols={2} spacing={8}>
                          <Num label="Latitude" value={c.latitude} onChange={v => patch(i, { latitude: v })} />
                          <Num label="Longitude" value={c.longitude} onChange={v => patch(i, { longitude: v })} />
                        </SimpleGrid>
                      </Col>
                      <Col span={QUARTER}><Text label="Phone" value={c.phone} onChange={v => patch(i, { phone: v })} /></Col>
                      <Col span={QUARTER}><Text label="Company email" type="email" value={c.email} onChange={v => patch(i, { email: v })} /></Col>
                      <Col span={QUARTER}><Text label="Invoice email" type="email" value={c.invoiceEmail} onChange={v => patch(i, { invoiceEmail: v })} /></Col>
                      <Col span={QUARTER}><Pick label="Invoice schedule" required value={c.invoiceScheduleId} options={schedules.options} loading={schedules.loading} onChange={v => patch(i, { invoiceScheduleId: v })} /></Col>
                      <Col span={QUARTER}><Pick label="Payment term" required value={c.paymentTermId} options={terms.options} loading={terms.loading} onChange={v => patch(i, { paymentTermId: v })} /></Col>
                    </Grid>
                    <Box p="sm" bg="var(--dd-surface)" style={INSET}>
                      <MText {...SECTION} mb={6}>Primary contact (books jobs)</MText>
                      <Grid columns={10} gutter={8} overflow="visible">
                        <Col span={{ base: 10, xs: 5, md: 2 }}><Text label="First name" required value={c.primaryContact.firstName} onChange={v => patch(i, { primaryContact: { ...c.primaryContact, firstName: v } })} /></Col>
                        <Col span={{ base: 10, xs: 5, md: 2 }}><Text label="Surname" value={c.primaryContact.surname} onChange={v => patch(i, { primaryContact: { ...c.primaryContact, surname: v } })} /></Col>
                        <Col span={{ base: 10, xs: 5, md: 2 }}><Text label="Email" required type="email" value={c.primaryContact.email} onChange={v => patch(i, { primaryContact: { ...c.primaryContact, email: v } })} /></Col>
                        <Col span={{ base: 10, xs: 5, md: 2 }}><Text label="Mobile" value={c.primaryContact.mobile} onChange={v => patch(i, { primaryContact: { ...c.primaryContact, mobile: v } })} /></Col>
                        <Col span={{ base: 10, md: 2 }}><Text label="Job title" value={c.primaryContact.jobTitle} onChange={v => patch(i, { primaryContact: { ...c.primaryContact, jobTitle: v } })} /></Col>
                        <Col span={10}><Check warn checked={c.inviteConfirmed} onChange={v => patch(i, { inviteConfirmed: v })}
                          label={<>Settings emails {c.primaryContact.email || 'the primary contact'} a booking sign-in when it creates this customer. Tick to confirm.</>} /></Col>
                      </Grid>
                    </Box>
                    <Box>
                      <Group justify="space-between" align="center">
                        <Box>
                          <MText {...SECTION}>Other booking contacts</MText>
                          <MText fz="xs" c="dimmed">Each needs a first name or surname, and an email.</MText>
                        </Box>
                        <Btn kind="ghost" onClick={() => patch(i, { contacts: [...c.contacts, newContact()] })}>Add contact</Btn>
                      </Group>
                      {c.contacts.map((ct, j) => (
                        <Grid key={j} columns={12} gutter={8} align="flex-end" mt={8} pt={j > 0 ? 8 : 0} style={j > 0 ? TOP : undefined} overflow="visible">
                          <Col span={{ base: 6, md: 2 }}><Text label="First name" value={ct.firstName} onChange={v => patch(i, { contacts: patchAt(c.contacts, j, { firstName: v }) })} /></Col>
                          <Col span={{ base: 6, md: 2 }}><Text label="Surname" value={ct.surname} onChange={v => patch(i, { contacts: patchAt(c.contacts, j, { surname: v }) })} /></Col>
                          <Col span={{ base: 12, sm: 6, md: 3 }}><Text label="Email" required type="email" value={ct.email} onChange={v => patch(i, { contacts: patchAt(c.contacts, j, { email: v }) })} /></Col>
                          <Col span={{ base: 12, sm: 6, md: 2 }}><Text label="Mobile" value={ct.mobile} onChange={v => patch(i, { contacts: patchAt(c.contacts, j, { mobile: v }) })} /></Col>
                          <Col span={{ base: 10, md: 2 }}><Check checked={ct.createSignIn} onChange={v => patch(i, { contacts: patchAt(c.contacts, j, { createSignIn: v }) })} label="Email a sign-in invite to this contact" /></Col>
                          <Col span={{ base: 2, md: 1 }}><Group justify="flex-end"><RemoveBtn onClick={() =>
                            undoable(`Removed contact ${[ct.firstName, ct.surname].filter(Boolean).join(' ') || ct.email || j + 1}.`,
                              patchAt(draft, i, { contacts: removeAt(c.contacts, j) }))} /></Group></Col>
                        </Grid>
                      ))}
                    </Box>
                  </Stack>
                </Collapse>
              </Box>
            )
          })}
        </Box>
      </Card>
      {importing && <SmartImport entityType={importing} onClose={() => setImporting(null)} onComplete={() => { setImporting(null); markSaved(); reload() }} />}
    </StepFrame>
  )
}
