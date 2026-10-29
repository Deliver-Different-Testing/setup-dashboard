import { useEffect, useState } from 'react'
import { Badge, Box, Group, SimpleGrid, Stack, Text as MText } from '@mantine/core'
import { TriangleAlert } from 'lucide-react'
import { useStore } from '../../store'
import * as api from '../../lib/api'
import type { BusinessProfile } from '../../lib/api'
import { LISTED_COUNTRIES, countryRules, isListedCountry, listedCountryName, settingMatchesTenant } from '../../lib/businessProfile'
import { StepFrame } from '../StepFrame'
import { useDraft } from '../useDraft'
import { Card, Pick, Suggest, Tags, Text } from '../ui'

const OTHER = 'Other'
const pair = { base: 1, sm: 2 } as const

export function BusinessStep() {
  const { draft, setDraft, dirty, markSaved } = useDraft<BusinessProfile>(s => s.business)
  const set = (p: Partial<BusinessProfile>) => setDraft(d => ({ ...d, ...p }))
  const setContact = (p: Partial<BusinessProfile['primaryContact']>) => setDraft(d => ({ ...d, primaryContact: { ...d.primaryContact, ...p } }))

  // A stored country we don't list (typed before this was a picklist) shows as Other with its text kept.
  const [otherChosen, setOtherChosen] = useState(false)
  const showOther = otherChosen || (!!draft.country && !isListedCountry(draft.country))
  const rules = countryRules(draft.country)

  return (
    <StepFrame step="business" title="Business profile" draft={draft} dirty={dirty} onSaved={markSaved}
      intro={<>Record who the tenant is. Nothing here is sent to Settings, and only the starred fields are needed. DFRNT confirms the checklist below in the tenant's system before anyone is invited.</>}>
      <SystemSettingsNow />
      <Card title="Company">
        <SimpleGrid cols={pair} spacing="sm">
          <Text label="Trading name" required hint="As it appears in Settings" autoComplete="organization"
            value={draft.companyName} onChange={v => set({ companyName: v })} />
          <Text label="Legal name" hint="As registered, if different" value={draft.legalName} onChange={v => set({ legalName: v })} />
        </SimpleGrid>
      </Card>
      <Card title="Registration">
        <Stack gap="sm" maw={480}>
          <Pick label="Country" options={[...LISTED_COUNTRIES, OTHER].map(c => ({ value: c, label: c }))}
            value={showOther ? OTHER : listedCountryName(draft.country)}
            onChange={(v: string | undefined) => {
              setOtherChosen(v === OTHER)
              set({ country: v === OTHER ? (isListedCountry(draft.country) ? undefined : draft.country) : v })
            }} />
          {showOther && <Text label="Country name" value={draft.country} onChange={v => set({ country: v })} autoComplete="country-name" />}
          <Suggest label="Business type" options={rules.businessTypes} value={draft.businessType} onChange={v => set({ businessType: v })}
            placeholder={rules.businessTypes[0] ? `e.g. ${rules.businessTypes[0]}` : undefined} />
          <Text label={rules.registrationLabel} value={draft.registrationNumber} onChange={v => set({ registrationNumber: v })} />
          {(rules.hasState || draft.stateOfIncorporation) && (
            <Text label={rules.stateLabel || 'State of incorporation'} value={draft.stateOfIncorporation} onChange={v => set({ stateOfIncorporation: v })} />
          )}
        </Stack>
      </Card>
      <Card title="Operations">
        <Stack gap="sm">
          <Tags label="Where they deliver" hint="Cities, regions or countries" value={draft.geography} onChange={v => set({ geography: v })} />
          <Tags label="What they deliver" hint="For example parcels, pharmacy, freight" value={draft.verticals} onChange={v => set({ verticals: v })} />
          <SimpleGrid cols={pair} spacing="sm">
            <Text label="Current system" value={draft.currentSystem} onChange={v => set({ currentSystem: v })} placeholder="e.g. Datatrac" />
            <Text label="Deliveries per month" value={draft.deliveriesPerMonth} onChange={v => set({ deliveriesPerMonth: v })} placeholder="e.g. 12,000" />
          </SimpleGrid>
        </Stack>
      </Card>
      <Card title="Primary setup contact">
        <SimpleGrid cols={pair} spacing="sm">
          <Text label="Name" required autoComplete="name" value={draft.primaryContact.name} onChange={v => setContact({ name: v })} />
          <Text label="Title" autoComplete="organization-title" value={draft.primaryContact.title} onChange={v => setContact({ title: v })} />
          <Text label="Email" required type="email" autoComplete="email" value={draft.primaryContact.email} onChange={v => setContact({ email: v })} />
          <Text label="Phone" type="tel" autoComplete="tel" value={draft.primaryContact.phone} onChange={v => setContact({ phone: v })} />
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
    api.getTenantSummary(sessionId).then(setData).catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not load system settings'))
  }, [sessionId])

  if (error) return <Card title="Current system settings"><MText size="xs" c="var(--mantine-color-red-text)">{error}</MText></Card>
  if (!data) return null
  const s = data.settings
  const names = [session?.business.companyName, session?.business.legalName]
  const hasName = names.some(n => n?.trim())
  // Country code and application name are shared wording, not tenant identity, so they're never flagged.
  const rows: [string, string | undefined, boolean][] = [
    ['Company address', s.CompanyAddress, true], ['Admin email', s.AdminEmail, true],
    ['Country code', s.CountryCode, false], ['Application name', s.ApplicationName, false],
  ]

  return (
    <Card title="This tenant's system settings now">
      <Box component="dl" m={0} fz="xs" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 16, rowGap: 6 }}>
        {rows.map(([k, v, checked]) => {
          const foreign = checked && settingMatchesTenant(v, names) === 'mismatch'
          return (
            <Box key={k} style={{ display: 'contents' }}>
              <Box component="dt" c="dimmed">{k}</Box>
              <Box component="dd" m={0}>
                <Group gap={6} wrap="wrap">
                  <span>{v || '—'}</span>
                  {foreign && <Badge size="xs" color="orange" variant="light" leftSection={<TriangleAlert size={10} aria-hidden />}>Not this tenant</Badge>}
                </Group>
              </Box>
            </Box>
          )
        })}
      </Box>
      <MText fz="xs" c="dimmed" mt="xs">
        {hasName
          ? <>New tenants can carry another tenant's details. If anything here isn't {session?.business.companyName || session?.business.legalName}'s, fix it in System Settings before ticking "system settings and email wording".</>
          : <>Enter a trading name to check these against this tenant. New tenants can carry another tenant's details.</>}
      </MText>
      <MText fz="xs" c="dimmed" mt={4}>
        Already in the system: {data.counts.Clients ?? 0} customers, {data.counts.Team ?? 0} staff, {data.counts.Couriers ?? 0} couriers, {data.counts.Zones ?? 0} zones and {data.counts.Automations ?? 0} active automations.
      </MText>
    </Card>
  )
}
