import { useState } from 'react'
import { Box, Grid, Group, Paper, SimpleGrid, Stack, Text as MText } from '@mantine/core'
import { useStore } from '../../store'
import type { PersonRow, RoleRow, TeamStep as Team } from '../../lib/api'
import { StepFrame } from '../StepFrame'
import { SmartImport } from '../SmartImport'
import { useDraft } from '../useDraft'
import { Btn, Card, Check, Pick, RemoveBtn, Text } from '../ui'
import { patchAt, removeAt, useLookup } from '../../lib/helpers'

const Col = Grid.Col
const TOP = { borderTop: '1px solid var(--dd-outline-variant)' }

interface Tile { featureKey: string; displayName: string; condition?: string | null }

const newRole = (): RoleRow => ({ tiles: [] })
const newPerson = (): PersonRow => ({ inviteConfirmed: false })

export function TeamStep() {
  const reload = useStore(s => s.reload)
  const { draft, setDraft, dirty, markSaved } = useDraft<Team>(s => s.team)
  const tiles = useLookup<Tile[]>('tiles')
  const [importing, setImporting] = useState(false)

  const setRoles = (roles: RoleRow[]) => setDraft(d => ({ ...d, roles }))
  const setPeople = (people: PersonRow[]) => setDraft(d => ({ ...d, people }))
  const roleOptions = draft.roles.filter(r => r.name?.trim()).map(r => ({ value: r.name!.trim(), label: r.name!.trim() }))

  return (
    <StepFrame step="team" title="Team, roles and access" sendsTo="Settings" draft={draft} dirty={dirty} onSaved={markSaved}
      intro={<>
        Roles are created in Settings tagged <b>Tenant Staff</b> and start with every tile off; the tiles ticked here are switched on in
        Access Control. People are added to the tenant's own client file with their role - Settings creates their login and
        <b> emails them a sign-in invite</b>. No staff file is created.
      </>}>
      <Card title="Roles" right={<Btn kind="ghost" onClick={() => setRoles([...draft.roles, newRole()])}>+ Role</Btn>}>
        {draft.roles.length === 0 && <MText size="xs" c="dimmed">Usually a tenant admin and an operations role.</MText>}
        <Stack gap="lg">
          {draft.roles.map((r, i) => (
            <Paper key={i} withBorder p="sm" radius="md" shadow="none">
              <Group gap="sm" align="flex-end" wrap="nowrap">
                <Box style={{ flex: 1 }}><Text label="Role name" required value={r.name} onChange={v => setRoles(patchAt(draft.roles, i, { name: v }))} placeholder="e.g. Tenant Admin" /></Box>
                <Box style={{ flex: 1 }}><Text label="Description" value={r.description} onChange={v => setRoles(patchAt(draft.roles, i, { description: v }))} /></Box>
                <RemoveBtn onClick={() => setRoles(removeAt(draft.roles, i))} />
              </Group>
              <Box mt="sm">
                <MText fz={11} fw={600} tt="uppercase" lts={0.5} c="dimmed">Tiles this role can open</MText>
                {tiles.loading && <MText size="xs" c="dimmed">Loading tiles from Access Control…</MText>}
                {tiles.error && <MText size="xs" c="var(--mantine-color-red-text)">{tiles.error}</MText>}
                <SimpleGrid cols={3} spacing={6} verticalSpacing={6} mt={4}>
                  {(tiles.data ?? []).map(t => {
                    const on = r.tiles.includes(t.featureKey)
                    return (
                      <Check key={t.featureKey} checked={on}
                        label={<>{t.displayName}{t.condition && <MText span inherit c="dimmed"> ({t.condition})</MText>}</>}
                        onChange={v => setRoles(patchAt(draft.roles, i, { tiles: v ? [...r.tiles, t.featureKey] : r.tiles.filter(x => x !== t.featureKey) }))} />
                    )
                  })}
                </SimpleGrid>
                <MText fz={11} c="dimmed" mt={4}>
                  Role actions (View Financial Data, Manage Users, Edit Settings…) follow their tile. DFRNT switches any off in Settings &gt; Roles.
                </MText>
              </Box>
            </Paper>
          ))}
        </Stack>
      </Card>

      <Card title="People" right={<Group gap={8}>
        <Btn kind="ghost" disabled={dirty} title={dirty ? 'Save first' : ''} onClick={() => setImporting(true)}>Import file</Btn>
        <Btn kind="ghost" onClick={() => setPeople([...draft.people, newPerson()])}>+ Person</Btn>
      </Group>}>
        {draft.people.length === 0 && <MText size="xs" c="dimmed">Staff who will sign in to DFRNT.</MText>}
        <Stack gap="sm">
          {draft.people.map((p, i) => (
            <Grid key={i} columns={6} gutter={8} align="flex-end" pt="sm" style={TOP} overflow="visible">
              <Col span={1}><Text label="Email" required type="email" value={p.email} onChange={v => setPeople(patchAt(draft.people, i, { email: v }))} /></Col>
              <Col span={1}><Text label="First name" required value={p.firstName} onChange={v => setPeople(patchAt(draft.people, i, { firstName: v }))} /></Col>
              <Col span={1}><Text label="Last name" value={p.lastName} onChange={v => setPeople(patchAt(draft.people, i, { lastName: v }))} /></Col>
              <Col span={1}><Text label="Job title" value={p.jobTitle} onChange={v => setPeople(patchAt(draft.people, i, { jobTitle: v }))} /></Col>
              <Col span={1}><Pick label="Role" required value={p.roleName} options={roleOptions} onChange={v => setPeople(patchAt(draft.people, i, { roleName: v }))} /></Col>
              <Col span={1}>
                <Group gap={8} align="flex-end" wrap="nowrap">
                  <Text label="Mobile" value={p.mobile} onChange={v => setPeople(patchAt(draft.people, i, { mobile: v }))} />
                  <RemoveBtn onClick={() => setPeople(removeAt(draft.people, i))} />
                </Group>
              </Col>
              <Col span={6}>
                <Check warn checked={p.inviteConfirmed} onChange={v => setPeople(patchAt(draft.people, i, { inviteConfirmed: v }))}
                  label={<>Send {p.email || 'them'} a sign-in invite now. <MText span inherit c="dimmed">Adding a person always emails them; they aren't sent until this is ticked.</MText></>} />
              </Col>
            </Grid>
          ))}
        </Stack>
      </Card>

      {importing && <SmartImport entityType="team" onClose={() => setImporting(false)} onComplete={() => { setImporting(false); markSaved(); reload() }} />}
    </StepFrame>
  )
}
