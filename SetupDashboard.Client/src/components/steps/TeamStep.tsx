import { useState } from 'react'
import { Alert, Button, Group, Menu, Stack, Text as MText } from '@mantine/core'
import { useStore } from '../../store'
import type { PersonRow, TeamStep as Team } from '../../lib/api'
import { StepFrame } from '../StepFrame'
import { SmartImport } from '../SmartImport'
import { useDraft } from '../useDraft'
import { Btn, Card } from '../ui'
import { useLookup } from '../../lib/helpers'
import { starterRole, teamWarnings, type Tile } from '../../lib/team'
import { AccessMatrix } from './team/AccessMatrix'
import { PeopleList } from './team/PeopleList'

const newPerson = (): PersonRow => ({ inviteConfirmed: false })

export function TeamStep() {
  const reload = useStore(s => s.reload)
  const { draft, setDraft, dirty, markSaved } = useDraft<Team>(s => s.team)
  const tiles = useLookup<Tile[]>('tiles')
  const [importing, setImporting] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)

  const addRole = (kind: 'admin' | 'blank') => {
    setDraft(d => ({ ...d, roles: [...d.roles, starterRole(kind, tiles.data ?? [])] }))
    if (kind === 'blank') setEditing(draft.roles.length)
  }
  const warnings = teamWarnings(draft)

  return (
    <StepFrame step="team" title="Team, roles and access" sendsTo="Settings" draft={draft} dirty={dirty} onSaved={markSaved}
      intro={<>Set up the roles the tenant's staff sign in with, what each role can open in the Hub, and who's on each role.
        People are only emailed a sign-in invite when you switch it on for them and send.</>}>
      <Card title="Roles and what they can open" right={
        <Menu position="bottom-end" withinPortal>
          <Menu.Target><Button size="xs" variant="default">Add role</Button></Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={() => addRole('admin')} disabled={!tiles.data}>
              Tenant admin<MText fz={11} c="dimmed">Every tile switched on</MText>
            </Menu.Item>
            <Menu.Item onClick={() => addRole('blank')}>
              Blank role<MText fz={11} c="dimmed">Name it and pick its tiles</MText>
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      }>
        <Stack gap="sm">
          {draft.roles.length === 0 && <MText size="xs" c="dimmed">No roles yet. Start with a tenant admin, then add a role for operations staff.</MText>}
          <AccessMatrix team={draft} tiles={tiles} onChange={setDraft} editing={editing} setEditing={setEditing} />
          {draft.roles.length > 0 && (
            <MText fz={11} c="dimmed">
              Role actions such as View Financial Data and Manage Users follow their tile. DFRNT can switch any of them off in Settings &gt; Roles.
            </MText>
          )}
        </Stack>
      </Card>

      <Card title="People" right={<Group gap={8}>
        <Btn kind="ghost" disabled={dirty} title={dirty ? 'Save first' : ''} onClick={() => setImporting(true)}>Import people</Btn>
        <Btn kind="ghost" onClick={() => setDraft(d => ({ ...d, people: [...d.people, newPerson()] }))}>Add person</Btn>
      </Group>}>
        {draft.people.length === 0 && <MText size="xs" c="dimmed">No people yet. Add the staff who will sign in to DFRNT, or import them from a spreadsheet.</MText>}
        <PeopleList people={draft.people} roles={draft.roles} onChange={people => setDraft(d => ({ ...d, people }))} />
      </Card>

      {warnings.length > 0 && (
        <Alert variant="light" color="orange" py="xs" px="md">
          <Stack gap={2}>{warnings.map(w => <MText key={w} fz="xs">{w}</MText>)}</Stack>
        </Alert>
      )}

      {importing && <SmartImport entityType="team" onClose={() => setImporting(false)} onComplete={() => { setImporting(false); markSaved(); reload() }} />}
    </StepFrame>
  )
}
