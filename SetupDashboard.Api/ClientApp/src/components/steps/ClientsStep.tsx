import { useState } from 'react'
import { useStore } from '../../store'
import type { ClientContactRow, ClientRow } from '../../lib/api'
import { StepFrame } from '../StepFrame'
import { SmartImport } from '../SmartImport'
import { useDraft } from '../useDraft'
import { Btn, Card, Check, Num, Pick, RemoveBtn, Text } from '../ui'
import { patchAt, removeAt, useLookup } from '../../lib/helpers'

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
      <Card title={`Customers (${draft.length})`} right={<div className="flex gap-2">
        <Btn kind="ghost" disabled={dirty} title={dirty ? 'Save first' : ''} onClick={() => setImporting('clients')}>Import customers</Btn>
        <Btn kind="ghost" disabled={dirty || draft.length === 0} title={dirty ? 'Save first' : ''} onClick={() => setImporting('contacts')}>Import contacts</Btn>
        <Btn kind="ghost" onClick={() => { setDraft(d => [...d, newClient()]); setOpen(draft.length) }}>+ Customer</Btn>
      </div>}>
        {draft.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-4 p-3 rounded-xl bg-lgrey/60">
            <Pick label="Invoice schedule for all" value={undefined} options={schedules.options} loading={schedules.loading} error={schedules.error}
              onChange={v => v != null && applyAll({ invoiceScheduleId: v })} placeholder="Apply to every customer…" />
            <Pick label="Payment term for all" value={undefined} options={terms.options} loading={terms.loading} error={terms.error}
              onChange={v => v != null && applyAll({ paymentTermId: v })} placeholder="Apply to every customer…" />          </div>
        )}
        <div className="divide-y divide-gray-100">
          {draft.map((c, i) => (
            <div key={i} className="py-2">
              <button type="button" onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between text-left">
                <span className="text-sm font-medium text-navy">{c.code || '—'} · {c.name || 'New customer'}
                  <span className="text-xs text-gray-400 ml-2">{[c.address, c.suburb, c.city].filter(Boolean).join(', ') || 'no address yet'}</span></span>
                <span className="text-xs text-gray-400">{open === i ? '▲' : '▼'}</span>
              </button>
              {open === i && (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-4 gap-2">
                    <Text label="Client code" required value={c.code} onChange={v => patch(i, { code: v })} />
                    <div className="col-span-2"><Text label="Name" required value={c.name} onChange={v => patch(i, { name: v })} /></div>
                    <div className="flex justify-end items-end"><RemoveBtn onClick={() => { setDraft(d => removeAt(d, i)); setOpen(null) }} /></div>
                    <div className="col-span-2"><Text label="Street address" required value={c.address} onChange={v => patch(i, { address: v })} /></div>
                    <Text label="Unit / suite" value={c.unit} onChange={v => patch(i, { unit: v })} />
                    <Text label={us ? 'Zip code' : 'Post code'} value={c.postCode} onChange={v => patch(i, { postCode: v })} />
                    <Text label={us ? 'City' : 'Suburb'} required value={c.suburb} onChange={v => patch(i, { suburb: v })} />
                    <Text label={us ? 'State' : 'City'} required value={c.city} onChange={v => patch(i, { city: v })} />
                    <Text label="Country" value={c.country} onChange={v => patch(i, { country: v })} />
                    <div className="grid grid-cols-2 gap-2">
                      <Num label="Latitude" value={c.latitude} onChange={v => patch(i, { latitude: v })} />
                      <Num label="Longitude" value={c.longitude} onChange={v => patch(i, { longitude: v })} />
                    </div>
                    <Text label="Phone" value={c.phone} onChange={v => patch(i, { phone: v })} />
                    <Text label="Company email" value={c.email} onChange={v => patch(i, { email: v })} />
                    <Text label="Invoice email" value={c.invoiceEmail} onChange={v => patch(i, { invoiceEmail: v })} />
                    <Pick label="Invoice schedule" required value={c.invoiceScheduleId} options={schedules.options} loading={schedules.loading} onChange={v => patch(i, { invoiceScheduleId: v })} />
                    <Pick label="Payment term" required value={c.paymentTermId} options={terms.options} loading={terms.loading} onChange={v => patch(i, { paymentTermId: v })} />
                  </div>
                  <div className="grid grid-cols-5 gap-2 p-3 rounded-xl bg-lgrey/60">
                    <span className="col-span-5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Primary contact (books jobs)</span>
                    <Text label="First name" required value={c.primaryContact.firstName} onChange={v => patch(i, { primaryContact: { ...c.primaryContact, firstName: v } })} />
                    <Text label="Surname" value={c.primaryContact.surname} onChange={v => patch(i, { primaryContact: { ...c.primaryContact, surname: v } })} />
                    <Text label="Email" required type="email" value={c.primaryContact.email} onChange={v => patch(i, { primaryContact: { ...c.primaryContact, email: v } })} />
                    <Text label="Mobile" value={c.primaryContact.mobile} onChange={v => patch(i, { primaryContact: { ...c.primaryContact, mobile: v } })} />
                    <Text label="Job title" value={c.primaryContact.jobTitle} onChange={v => patch(i, { primaryContact: { ...c.primaryContact, jobTitle: v } })} />
                    <div className="col-span-5"><Check warn checked={c.inviteConfirmed} onChange={v => patch(i, { inviteConfirmed: v })}
                      label={<>Email {c.primaryContact.email || 'the primary contact'} a booking sign-in when this customer is created (Settings always does).</>} /></div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Other booking contacts</span>
                      <Btn kind="ghost" onClick={() => patch(i, { contacts: [...c.contacts, newContact()] })}>+ Contact</Btn>
                    </div>
                    {c.contacts.map((ct, j) => (
                      <div key={j} className="grid grid-cols-6 gap-2 items-end mt-2">
                        <Text label="First name" value={ct.firstName} onChange={v => patch(i, { contacts: patchAt(c.contacts, j, { firstName: v }) })} />
                        <Text label="Surname" value={ct.surname} onChange={v => patch(i, { contacts: patchAt(c.contacts, j, { surname: v }) })} />
                        <Text label="Email" required type="email" value={ct.email} onChange={v => patch(i, { contacts: patchAt(c.contacts, j, { email: v }) })} />
                        <Text label="Mobile" value={ct.mobile} onChange={v => patch(i, { contacts: patchAt(c.contacts, j, { mobile: v }) })} />
                        <Check checked={ct.createSignIn} onChange={v => patch(i, { contacts: patchAt(c.contacts, j, { createSignIn: v }) })} label="Sign-in + invite" />
                        <RemoveBtn onClick={() => patch(i, { contacts: removeAt(c.contacts, j) })} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
      {importing && <SmartImport entityType={importing} onClose={() => setImporting(null)} onComplete={() => { setImporting(null); markSaved(); reload() }} />}
    </StepFrame>
  )
}
