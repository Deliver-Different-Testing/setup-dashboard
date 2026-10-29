import { Grid, Stack } from '@mantine/core'
import type { PartnerRow } from '../../lib/api'
import { StepFrame } from '../StepFrame'
import { useDraft } from '../useDraft'
import { Btn, Card, Check, Num, Pick, RemoveBtn, Text } from '../ui'
import { patchAt, removeAt, useLookup } from '../../lib/helpers'

const Col = Grid.Col
const TOP = { borderTop: '1px solid var(--dd-outline-variant)' }

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
        <Stack gap="sm">
          {draft.map((p, i) => (
            <Grid key={i} columns={6} gutter={8} align="flex-end" pt="sm" style={TOP} overflow="visible">
              <Col span={2}><Text label="Name" required value={p.name} onChange={v => patch(i, { name: v })} /></Col>
              <Col span={1}><Text label="Contact name" value={p.contactName} onChange={v => patch(i, { contactName: v })} /></Col>
              <Col span={2}><Text label="Contact email" hint="gives them a login" type="email" value={p.contactEmail} onChange={v => patch(i, { contactEmail: v })} /></Col>
              <Col span={1}><RemoveBtn onClick={() => setDraft(d => removeAt(d, i))} /></Col>
              <Col span={1}><Pick label="Contact's role" required={!!p.contactEmail} value={p.primaryContactRoleId}
                options={(roles.data ?? []).map(r => ({ value: r.id, label: r.name }))} loading={roles.loading} error={roles.error}
                onChange={v => patch(i, { primaryContactRoleId: v })} /></Col>
              <Col span={1}><Text label="Phone" value={p.phone} onChange={v => patch(i, { phone: v })} /></Col>
              <Col span={1}><Text label="Address" value={p.addressLine1} onChange={v => patch(i, { addressLine1: v })} /></Col>
              <Col span={1}><Text label="City" value={p.city} onChange={v => patch(i, { city: v })} /></Col>
              <Col span={1}><Text label="State" value={p.state} onChange={v => patch(i, { state: v })} /></Col>
              <Col span={1}><Num label="Driver pay %" hint="of the job" value={p.defaultCourierPayPercent} onChange={v => patch(i, { defaultCourierPayPercent: v })} /></Col>
              <Col span={3}><Check checked={p.isNetworkPartner} onChange={v => patch(i, { isNetworkPartner: v })} label="Network partner (has its own client file and portal)" /></Col>
              {p.contactEmail && <Col span={3}><Check warn checked={p.inviteConfirmed} onChange={v => patch(i, { inviteConfirmed: v })}
                label={<>Email {p.contactEmail} a sign-in invite when this partner is created.</>} /></Col>}
            </Grid>
          ))}
        </Stack>
      </Card>
    </StepFrame>
  )
}
