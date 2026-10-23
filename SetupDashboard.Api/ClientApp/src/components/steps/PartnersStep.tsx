import type { PartnerRow } from '../../lib/api'
import { StepFrame } from '../StepFrame'
import { useDraft } from '../useDraft'
import { Btn, Card, Check, Num, Pick, RemoveBtn, Text } from '../ui'
import { patchAt, removeAt, useLookup } from '../../lib/helpers'

export function PartnersStep() {
  const { draft, setDraft, dirty, markSaved } = useDraft<PartnerRow[]>(s => s.partners)
  const roles = useLookup<{ id: number; name: string }[]>('partner-roles')
  const patch = (i: number, p: Partial<PartnerRow>) => setDraft(d => patchAt(d, i, p))

  return (
    <StepFrame step="partners" title="Agents and network partners" sendsTo="Settings" draft={draft} dirty={dirty} onSaved={markSaved}
      intro={<>
        Created in Settings &gt; Agents &amp; Network Partners. With a contact email, Settings also makes the partner's client file and a
        login, and <b>emails the contact an invite</b>. A brand-new tenant needs at least one customer first - Settings copies a few
        values from an existing client.
      </>}>
      <Card title={`Partners (${draft.length})`} right={<Btn kind="ghost" onClick={() => setDraft(d => [...d, { isNetworkPartner: true, inviteConfirmed: false }])}>+ Partner</Btn>}>
        <div className="space-y-3">
          {draft.map((p, i) => (
            <div key={i} className="grid grid-cols-6 gap-2 items-end border-t border-gray-100 pt-3">
              <div className="col-span-2"><Text label="Name" required value={p.name} onChange={v => patch(i, { name: v })} /></div>
              <Text label="Contact name" value={p.contactName} onChange={v => patch(i, { contactName: v })} />
              <div className="col-span-2"><Text label="Contact email" hint="gives them a login" type="email" value={p.contactEmail} onChange={v => patch(i, { contactEmail: v })} /></div>
              <RemoveBtn onClick={() => setDraft(d => removeAt(d, i))} />
              <Pick label="Contact's role" required={!!p.contactEmail} value={p.primaryContactRoleId}
                options={(roles.data ?? []).map(r => ({ value: r.id, label: r.name }))} loading={roles.loading} error={roles.error}
                onChange={v => patch(i, { primaryContactRoleId: v })} />
              <Text label="Phone" value={p.phone} onChange={v => patch(i, { phone: v })} />
              <Text label="Address" value={p.addressLine1} onChange={v => patch(i, { addressLine1: v })} />
              <Text label="City" value={p.city} onChange={v => patch(i, { city: v })} />
              <Text label="State" value={p.state} onChange={v => patch(i, { state: v })} />
              <Num label="Driver pay %" hint="of the job" value={p.defaultCourierPayPercent} onChange={v => patch(i, { defaultCourierPayPercent: v })} />
              <div className="col-span-3"><Check checked={p.isNetworkPartner} onChange={v => patch(i, { isNetworkPartner: v })} label="Network partner (has its own client file and portal)" /></div>
              {p.contactEmail && <div className="col-span-3"><Check warn checked={p.inviteConfirmed} onChange={v => patch(i, { inviteConfirmed: v })}
                label={<>Email {p.contactEmail} a sign-in invite when this partner is created.</>} /></div>}
            </div>
          ))}
        </div>
      </Card>
    </StepFrame>
  )
}
