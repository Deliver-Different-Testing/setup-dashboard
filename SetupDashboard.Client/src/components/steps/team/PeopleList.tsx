import { useState } from 'react'
import { Badge, Button, Collapse, Grid, Group, Stack, Switch, Text } from '@mantine/core'
import type { PersonRow, RoleRow } from '../../../lib/api'
import { patchAt, removeAt } from '../../../lib/helpers'
import { useStore } from '../../../store'
import { Pick, RemoveBtn, Text as Field } from '../../ui'

const TOP = { borderTop: '1px solid var(--dd-outline-variant)' }

/** One person per row: who they are and their role up front, the optional details folded away. */
export function PeopleList({ people, roles, onChange }: { people: PersonRow[]; roles: RoleRow[]; onChange: (people: PersonRow[]) => void }) {
  const rows = useStore(s => s.session?.steps.team.rows ?? [])
  const [open, setOpen] = useState<Set<number>>(new Set())
  const invited = (p: PersonRow) => !!p.email && rows.some(r => r.kind === 'person' && r.status === 'created' && r.key.toLowerCase() === p.email!.trim().toLowerCase())
  const roleOptions = roles.filter(r => r.name?.trim()).map(r => ({ value: r.name!.trim(), label: r.name!.trim(), description: r.description }))
  const waiting = people.filter(p => !p.inviteConfirmed && !invited(p))
  const set = (i: number, patch: Partial<PersonRow>) => onChange(patchAt(people, i, patch))
  const toggle = (i: number) => setOpen(s => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n })
  const remove = (i: number) => { onChange(removeAt(people, i)); setOpen(new Set()) }

  return (
    <Stack gap={0}>
      {people.map((p, i) => (
        <Stack key={i} gap={6} py="sm" style={i > 0 ? TOP : undefined}>
          <Grid gutter={8} align="flex-end" overflow="visible">
            <Grid.Col span={{ base: 12, sm: 4 }}><Field label="Email" required type="email" value={p.email} onChange={v => set(i, { email: v })} autoComplete="off" /></Grid.Col>
            <Grid.Col span={{ base: 6, sm: 2 }}><Field label="First name" required value={p.firstName} onChange={v => set(i, { firstName: v })} /></Grid.Col>
            <Grid.Col span={{ base: 6, sm: 2 }}><Field label="Last name" value={p.lastName} onChange={v => set(i, { lastName: v })} /></Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <Pick label="Role" required value={p.roleName} options={roleOptions} onChange={(v: string) => set(i, { roleName: v })}
                placeholder={roleOptions.length ? 'Choose a role…' : 'Add a role above first'} />
            </Grid.Col>
          </Grid>
          <Group gap="xs" justify="space-between" wrap="nowrap">
            <Group gap="xs">
              <InviteStatus invited={invited(p)} confirmed={p.inviteConfirmed} onToggle={v => set(i, { inviteConfirmed: v })} />
              <Button size="compact-xs" variant="subtle" color="gray" onClick={() => toggle(i)} aria-expanded={open.has(i)}>
                {open.has(i) ? 'Hide job title and mobile' : p.jobTitle || p.mobile ? 'Job title and mobile' : 'Add job title and mobile'}
              </Button>
            </Group>
            <RemoveBtn onClick={() => remove(i)} />
          </Group>
          <Collapse in={open.has(i)}>
            <Grid gutter={8}>
              <Grid.Col span={{ base: 12, sm: 4 }}><Field label="Job title" value={p.jobTitle} onChange={v => set(i, { jobTitle: v })} /></Grid.Col>
              <Grid.Col span={{ base: 12, sm: 4 }}><Field label="Mobile" type="tel" value={p.mobile} onChange={v => set(i, { mobile: v })} /></Grid.Col>
            </Grid>
          </Collapse>
        </Stack>
      ))}
      {waiting.length > 1 && (
        <Group gap="sm" pt="sm" style={TOP}>
          <Button size="xs" variant="light" onClick={() => onChange(people.map(p => (waiting.includes(p) ? { ...p, inviteConfirmed: true } : p)))}>
            Invite all {waiting.length}
          </Button>
          <Text fz="xs" c="dimmed">They're emailed a sign-in link when you send this step.</Text>
        </Group>
      )}
    </Stack>
  )
}

/** Adding a person in Settings always emails them, so nobody is invited until it's switched on here. */
function InviteStatus({ invited, confirmed, onToggle }: { invited: boolean; confirmed: boolean; onToggle: (v: boolean) => void }) {
  if (invited) return <Badge variant="light" color="green" size="sm" tt="none">Invited</Badge>
  return (
    <Switch size="xs" checked={confirmed} onChange={e => onToggle(e.currentTarget.checked)} label="Email a sign-in invite when sent"
      title="Nothing is created in Settings until this is on, because creating a person emails them"
      styles={{ label: { fontSize: 'var(--mantine-font-size-xs)', color: confirmed ? undefined : 'var(--mantine-color-orange-text)' } }} />
  )
}
