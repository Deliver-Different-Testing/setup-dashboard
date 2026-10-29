import { useState } from 'react'
import { Box, Collapse, Grid, Group, SimpleGrid, Stack, Text as MText, UnstyledButton } from '@mantine/core'
import { useStore } from '../../store'
import type { ClientContactRow, ClientRow } from '../../lib/api'
import { StepFrame } from '../StepFrame'
import { SmartImport } from '../SmartImport'
import { useDraft } from '../useDraft'
import { Btn, Card, Check, Num, Pick, RemoveBtn, Text } from '../ui'
import { patchAt, removeAt, useLookup } from '../../lib/helpers'

const Col = Grid.Col
const TOP = { borderTop: '1px solid var(--dd-outline-variant)' }
const INSET = { borderRadius: 'var(--mantine-radius-md)' }

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

export function ClientsStep() {
  const me = useStore(s => s.me)
  const reload = useStore(s => s.reload)
  const { draft, setDraft, dirty, markSaved } = useDraft<ClientRow[]>(s => s.clients)
  const schedules = useOptions('invoice-schedules')
  const terms = useOptions('payment-terms')
  const [importing, setImporting] = useState<'clients' | 'contacts' | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  const us = me?.isUsTenant === true

  const patch = (i: number, p: Partial<ClientRow>) => setDraft(d => patchAt(d, i, p))
  const applyAll = (p: Partial<ClientRow>) => setDraft(d => d.map(c => ({ ...c, ...p })))

  return (
    <StepFrame step="clients" title="Customers and booking contacts" sendsTo="Settings" draft={draft} dirty={dirty} onSaved={markSaved}
      intro={<>
        Customers are created in Settings &gt; Clients &amp; Customers with exactly what it requires: code, name, a real address, invoice
        schedule, payment term and a primary contact. Settings <b>emails the primary contact a booking sign-in</b> when the customer is
        created. Give each customer a map position (or add it in Settings after) before using client-address schedules.
      </>}>
      <Card title={`Customers (${draft.length})`} right={<Group gap={8}>
        <Btn kind="ghost" disabled={dirty} title={dirty ? 'Save first' : ''} onClick={() => setImporting('clients')}>Import customers</Btn>
        <Btn kind="ghost" disabled={dirty || draft.length === 0} title={dirty ? 'Save first' : ''} onClick={() => setImporting('contacts')}>Import contacts</Btn>
        <Btn kind="ghost" onClick={() => { setDraft(d => [...d, newClient()]); setOpen(draft.length) }}>+ Customer</Btn>
      </Group>}>
        {draft.length > 0 && (
          <SimpleGrid cols={2} spacing="sm" mb="md" p="sm" bg="var(--dd-surface)" style={INSET}>
            <Pick label="Invoice schedule for all" value={undefined} options={schedules.options} loading={schedules.loading} error={schedules.error}
              onChange={v => v != null && applyAll({ invoiceScheduleId: v })} placeholder="Apply to every customer…" />
            <Pick label="Payment term for all" value={undefined} options={terms.options} loading={terms.loading} error={terms.error}
              onChange={v => v != null && applyAll({ paymentTermId: v })} placeholder="Apply to every customer…" />
          </SimpleGrid>
        )}
        <Box>
          {draft.map((c, i) => (
            <Box key={i} py={8} style={i > 0 ? TOP : undefined}>
              <UnstyledButton type="button" onClick={() => setOpen(open === i ? null : i)} w="100%">
                <Group justify="space-between" align="center" wrap="nowrap">
                  <MText size="sm" fw={500}>{c.code || '—'} · {c.name || 'New customer'}
                    <MText span size="xs" c="dimmed" ml={8}>{[c.address, c.suburb, c.city].filter(Boolean).join(', ') || 'no address yet'}</MText></MText>
                  <MText size="xs" c="dimmed">{open === i ? '▲' : '▼'}</MText>
                </Group>
              </UnstyledButton>
              <Collapse in={open === i}>
                <Stack gap="sm" mt="sm">
                  <Grid columns={4} gutter={8} align="flex-end" overflow="visible">
                    <Col span={1}><Text label="Client code" required value={c.code} onChange={v => patch(i, { code: v })} /></Col>
                    <Col span={2}><Text label="Name" required value={c.name} onChange={v => patch(i, { name: v })} /></Col>
                    <Col span={1}><Group justify="flex-end"><RemoveBtn onClick={() => { setDraft(d => removeAt(d, i)); setOpen(null) }} /></Group></Col>
                    <Col span={2}><Text label="Street address" required value={c.address} onChange={v => patch(i, { address: v })} /></Col>
                    <Col span={1}><Text label="Unit / suite" value={c.unit} onChange={v => patch(i, { unit: v })} /></Col>
                    <Col span={1}><Text label={us ? 'Zip code' : 'Post code'} value={c.postCode} onChange={v => patch(i, { postCode: v })} /></Col>
                    <Col span={1}><Text label={us ? 'City' : 'Suburb'} required value={c.suburb} onChange={v => patch(i, { suburb: v })} /></Col>
                    <Col span={1}><Text label={us ? 'State' : 'City'} required value={c.city} onChange={v => patch(i, { city: v })} /></Col>
                    <Col span={1}><Text label="Country" value={c.country} onChange={v => patch(i, { country: v })} /></Col>
                    <Col span={1}>
                      <SimpleGrid cols={2} spacing={8}>
                        <Num label="Latitude" value={c.latitude} onChange={v => patch(i, { latitude: v })} />
                        <Num label="Longitude" value={c.longitude} onChange={v => patch(i, { longitude: v })} />
                      </SimpleGrid>
                    </Col>
                    <Col span={1}><Text label="Phone" value={c.phone} onChange={v => patch(i, { phone: v })} /></Col>
                    <Col span={1}><Text label="Company email" value={c.email} onChange={v => patch(i, { email: v })} /></Col>
                    <Col span={1}><Text label="Invoice email" value={c.invoiceEmail} onChange={v => patch(i, { invoiceEmail: v })} /></Col>
                    <Col span={1}><Pick label="Invoice schedule" required value={c.invoiceScheduleId} options={schedules.options} loading={schedules.loading} onChange={v => patch(i, { invoiceScheduleId: v })} /></Col>
                    <Col span={1}><Pick label="Payment term" required value={c.paymentTermId} options={terms.options} loading={terms.loading} onChange={v => patch(i, { paymentTermId: v })} /></Col>
                  </Grid>
                  <Box p="sm" bg="var(--dd-surface)" style={INSET}>
                    <Grid columns={5} gutter={8} overflow="visible">
                      <Col span={5}><MText fz={11} fw={600} tt="uppercase" lts={0.5} c="dimmed">Primary contact (books jobs)</MText></Col>
                      <Col span={1}><Text label="First name" required value={c.primaryContact.firstName} onChange={v => patch(i, { primaryContact: { ...c.primaryContact, firstName: v } })} /></Col>
                      <Col span={1}><Text label="Surname" value={c.primaryContact.surname} onChange={v => patch(i, { primaryContact: { ...c.primaryContact, surname: v } })} /></Col>
                      <Col span={1}><Text label="Email" required type="email" value={c.primaryContact.email} onChange={v => patch(i, { primaryContact: { ...c.primaryContact, email: v } })} /></Col>
                      <Col span={1}><Text label="Mobile" value={c.primaryContact.mobile} onChange={v => patch(i, { primaryContact: { ...c.primaryContact, mobile: v } })} /></Col>
                      <Col span={1}><Text label="Job title" value={c.primaryContact.jobTitle} onChange={v => patch(i, { primaryContact: { ...c.primaryContact, jobTitle: v } })} /></Col>
                      <Col span={5}><Check warn checked={c.inviteConfirmed} onChange={v => patch(i, { inviteConfirmed: v })}
                        label={<>Email {c.primaryContact.email || 'the primary contact'} a booking sign-in when this customer is created (Settings always does).</>} /></Col>
                    </Grid>
                  </Box>
                  <Box>
                    <Group justify="space-between" align="center">
                      <MText fz={11} fw={600} tt="uppercase" lts={0.5} c="dimmed">Other booking contacts</MText>
                      <Btn kind="ghost" onClick={() => patch(i, { contacts: [...c.contacts, newContact()] })}>+ Contact</Btn>
                    </Group>
                    {c.contacts.map((ct, j) => (
                      <Grid key={j} columns={6} gutter={8} align="flex-end" mt={8} overflow="visible">
                        <Col span={1}><Text label="First name" value={ct.firstName} onChange={v => patch(i, { contacts: patchAt(c.contacts, j, { firstName: v }) })} /></Col>
                        <Col span={1}><Text label="Surname" value={ct.surname} onChange={v => patch(i, { contacts: patchAt(c.contacts, j, { surname: v }) })} /></Col>
                        <Col span={1}><Text label="Email" required type="email" value={ct.email} onChange={v => patch(i, { contacts: patchAt(c.contacts, j, { email: v }) })} /></Col>
                        <Col span={1}><Text label="Mobile" value={ct.mobile} onChange={v => patch(i, { contacts: patchAt(c.contacts, j, { mobile: v }) })} /></Col>
                        <Col span={1}><Check checked={ct.createSignIn} onChange={v => patch(i, { contacts: patchAt(c.contacts, j, { createSignIn: v }) })} label="Sign-in + invite" /></Col>
                        <Col span={1}><RemoveBtn onClick={() => patch(i, { contacts: removeAt(c.contacts, j) })} /></Col>
                      </Grid>
                    ))}
                  </Box>
                </Stack>
              </Collapse>
            </Box>
          ))}
        </Box>
      </Card>
      {importing && <SmartImport entityType={importing} onClose={() => setImporting(null)} onComplete={() => { setImporting(null); markSaved(); reload() }} />}
    </StepFrame>
  )
}
