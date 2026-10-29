import { useEffect, useState } from 'react'
import { Box, SimpleGrid, Text as MText } from '@mantine/core'
import { useStore } from '../../store'
import * as api from '../../lib/api'
import type { BusinessProfile } from '../../lib/api'
import { StepFrame } from '../StepFrame'
import { useDraft } from '../useDraft'
import { Card, Text } from '../ui'
import { csv } from '../../lib/helpers'

export function BusinessStep() {
  const { draft, setDraft, dirty, markSaved } = useDraft<BusinessProfile>(s => s.business)
  const set = (p: Partial<BusinessProfile>) => setDraft(d => ({ ...d, ...p }))
  const setContact = (p: Partial<BusinessProfile['primaryContact']>) => setDraft(d => ({ ...d, primaryContact: { ...d.primaryContact, ...p } }))

  return (
    <StepFrame step="business" title="Business profile" draft={draft} dirty={dirty} onSaved={markSaved}
      intro={<>Who the tenant is. This page doesn't write anywhere: the checklist below is what DFRNT confirms in the tenant's own system before anyone is invited.</>}>
      <SystemSettingsNow />
      <Card title="Company">
        <SimpleGrid cols={2} spacing="sm">
          <Text label="Trading name" required value={draft.companyName} onChange={v => set({ companyName: v })} />
          <Text label="Legal name" value={draft.legalName} onChange={v => set({ legalName: v })} />
          <Text label="Country" value={draft.country} onChange={v => set({ country: v })} placeholder="e.g. United States" />
          <Text label="Registration number" value={draft.registrationNumber} onChange={v => set({ registrationNumber: v })} />
          <Text label="State of incorporation" value={draft.stateOfIncorporation} onChange={v => set({ stateOfIncorporation: v })} />
          <Text label="Business type" value={draft.businessType} onChange={v => set({ businessType: v })} placeholder="e.g. LLC" />
          <Text label="Where they deliver" hint="comma separated" value={draft.geography.join(', ')} onChange={v => set({ geography: csv(v) })} />
          <Text label="What they deliver" hint="comma separated" value={draft.verticals.join(', ')} onChange={v => set({ verticals: csv(v) })} />
          <Text label="Current system" value={draft.currentSystem} onChange={v => set({ currentSystem: v })} placeholder="e.g. Datatrac" />
          <Text label="Deliveries per month" value={draft.deliveriesPerMonth} onChange={v => set({ deliveriesPerMonth: v })} />
        </SimpleGrid>
      </Card>
      <Card title="Primary contact for the setup">
        <SimpleGrid cols={2} spacing="sm">
          <Text label="Name" required value={draft.primaryContact.name} onChange={v => setContact({ name: v })} />
          <Text label="Email" required type="email" value={draft.primaryContact.email} onChange={v => setContact({ email: v })} />
          <Text label="Phone" value={draft.primaryContact.phone} onChange={v => setContact({ phone: v })} />
          <Text label="Title" value={draft.primaryContact.title} onChange={v => setContact({ title: v })} />
        </SimpleGrid>
      </Card>
    </StepFrame>
  )
}

/** What the tenant database's own settings say right now - so a copied tenant shows up before invites go out. */
function SystemSettingsNow() {
  const session = useStore(s => s.session)
  const sessionId = session?.id
  const [data, setData] = useState<{ settings: Record<string, string>; counts: Record<string, number> } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) return
    api.getTenantSummary(sessionId).then(setData).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load'))
  }, [sessionId])

  if (error) return <Card title="This tenant's system settings now"><MText size="xs" c="var(--mantine-color-red-text)">{error}</MText></Card>
  if (!data) return null
  const s = data.settings
  const company = session?.business.companyName?.toLowerCase()
  const looksForeign = (v?: string) => !!v && !!company && !v.toLowerCase().includes(company.split(' ')[0])

  return (
    <Card title="This tenant's system settings now">
      <Box component="dl" m={0} fz="xs" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 16, rowGap: 4 }}>
        {[['Company address', s.CompanyAddress], ['Admin email', s.AdminEmail], ['Country code', s.CountryCode], ['Application name', s.ApplicationName]].map(([k, v]) => (
          <Box key={k} style={{ display: 'contents' }}>
            <Box component="dt" c="dimmed">{k}</Box>
            {looksForeign(v) && k !== 'Country code' && k !== 'Application name'
              ? <Box component="dd" m={0} c="var(--mantine-color-orange-text)" fw={500}>{v || '—'}</Box>
              : <Box component="dd" m={0}>{v || '—'}</Box>}
          </Box>
        ))}
      </Box>
      <MText fz={11} c="dimmed" mt="xs">
        New tenant databases can carry another tenant's details. If anything here isn't {session?.business.companyName || 'this tenant'}'s,
        it needs fixing in System Settings before the "system settings and email wording" item is ticked.
      </MText>
      <MText fz={11} c="dimmed" mt={4}>
        Already in the system: {data.counts.Clients ?? 0} customers, {data.counts.Team ?? 0} staff, {data.counts.Couriers ?? 0} couriers, {data.counts.Zones ?? 0} zones, {data.counts.Automations ?? 0} active automations.
      </MText>
    </Card>
  )
}
