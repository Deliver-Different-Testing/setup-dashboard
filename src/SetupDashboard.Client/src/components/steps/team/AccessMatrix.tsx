import { useState } from 'react'
import { ActionIcon, Button, Checkbox, Group, Menu, Popover, ScrollArea, SegmentedControl, Stack, Table, Text, UnstyledButton } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { MoreHorizontal } from 'lucide-react'
import type { RoleRow, TeamStep } from '../../../lib/api'
import { peopleOn, removeRole, renameRole, setTile, type Tile } from '../../../lib/team'
import { Text as Field } from '../../ui'

interface Props {
  team: TeamStep
  tiles: { data: Tile[] | null; loading: boolean; error: string | null }
  onChange: (team: TeamStep) => void
  /** Index of a just-added role, whose details open straight away. */
  editing: number | null
  setEditing: (i: number | null) => void
}

const STICKY = { position: 'sticky', left: 0, zIndex: 1, background: 'var(--dd-surface-container)' } as const
const roleLabel = (r: RoleRow, i: number) => r.name?.trim() || `Role ${i + 1}`

/** Tiles down the side, roles across the top: you can see at a glance how roles differ. */
export function AccessMatrix({ team, tiles, onChange, editing, setEditing }: Props) {
  const narrow = useMediaQuery('(max-width: 48em)')
  const [focus, setFocus] = useState(0)
  const list = tiles.data ?? []
  const patchRole = (i: number, role: RoleRow) => onChange({ ...team, roles: team.roles.map((r, j) => (j === i ? role : r)) })

  if (tiles.loading) return <Text size="xs" c="dimmed">Loading tiles from Access Control…</Text>
  if (tiles.error) return <Text size="xs" c="var(--mantine-color-red-text)">{tiles.error}</Text>
  if (team.roles.length === 0) return null

  const header = (r: RoleRow, i: number) => (
    <RoleHeader key={i} role={r} label={roleLabel(r, i)} people={peopleOn(team.people, r).length} tiles={list}
      open={editing === i} setOpen={o => setEditing(o ? i : null)}
      onRename={v => onChange(renameRole(team, i, v))}
      onDescribe={v => patchRole(i, { ...r, description: v })}
      onAll={on => patchRole(i, { ...r, tiles: on ? list.map(t => t.featureKey) : [] })}
      onRemove={() => { onChange(removeRole(team, i)); setEditing(null); setFocus(0) }} />
  )

  const tileName = (t: Tile) => (
    <>
      <Text span size="sm">{t.displayName}</Text>
      {t.condition && <Text fz={11} c="dimmed">{t.condition}</Text>}
    </>
  )

  if (narrow) {
    const i = Math.min(focus, team.roles.length - 1)
    const r = team.roles[i]
    return (
      <Stack gap="sm">
        <SegmentedControl fullWidth size="xs" value={String(i)} onChange={v => setFocus(Number(v))}
          data={team.roles.map((x, j) => ({ value: String(j), label: roleLabel(x, j) }))} />
        {header(r, i)}
        <Stack gap={8}>
          {list.map(t => (
            <Checkbox key={t.featureKey} size="sm" checked={r.tiles.includes(t.featureKey)} label={tileName(t)}
              onChange={e => patchRole(i, setTile(r, t.featureKey, e.currentTarget.checked))} />
          ))}
        </Stack>
      </Stack>
    )
  }

  return (
    <ScrollArea type="auto" offsetScrollbars>
      <Table withRowBorders verticalSpacing={6} horizontalSpacing="sm" style={{ minWidth: 220 + team.roles.length * 150 }}>
        <Table.Thead>
          <Table.Tr style={{ verticalAlign: 'bottom' }}>
            <Table.Th style={{ ...STICKY, width: 220 }}><Text fz="xs" c="dimmed" fw={500}>Tile</Text></Table.Th>
            {team.roles.map((r, i) => <Table.Th key={i} style={{ minWidth: 150 }}>{header(r, i)}</Table.Th>)}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {list.map(t => (
            <Table.Tr key={t.featureKey}>
              <Table.Td style={STICKY}>{tileName(t)}</Table.Td>
              {team.roles.map((r, i) => (
                <Table.Td key={i}>
                  <Checkbox size="sm" checked={r.tiles.includes(t.featureKey)} aria-label={`${roleLabel(r, i)} can open ${t.displayName}`}
                    onChange={e => patchRole(i, setTile(r, t.featureKey, e.currentTarget.checked))} />
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  )
}

function RoleHeader({ role, label, people, tiles, open, setOpen, onRename, onDescribe, onAll, onRemove }: {
  role: RoleRow; label: string; people: number; tiles: Tile[]; open: boolean; setOpen: (o: boolean) => void
  onRename: (v: string | undefined) => void; onDescribe: (v: string | undefined) => void
  onAll: (on: boolean) => void; onRemove: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const unnamed = !role.name?.trim()
  const empty = role.tiles.length === 0
  const remove = () => { if (people > 0 && !confirming) setConfirming(true); else onRemove() }

  return (
    <Group gap={4} wrap="nowrap" align="flex-start" justify="space-between">
      <Popover opened={open} onChange={o => { setOpen(o); setConfirming(false) }} position="bottom-start" width={280} trapFocus withArrow>
        <Popover.Target>
          <UnstyledButton onClick={() => setOpen(!open)} title="Edit name and description" style={{ textAlign: 'left', minWidth: 0 }}>
            <Text size="sm" fw={700} truncate c={unnamed ? 'var(--mantine-color-orange-text)' : undefined}>{unnamed ? 'Name this role' : label}</Text>
            <Text fz={11} c="dimmed" fw={400}>
              {people === 1 ? '1 person' : `${people} people`}
              {empty && <Text span inherit c="var(--mantine-color-orange-text)">, no tiles</Text>}
            </Text>
          </UnstyledButton>
        </Popover.Target>
        <Popover.Dropdown>
          <Stack gap="xs">
            <Field label="Role name" required value={role.name} onChange={onRename} placeholder="e.g. Operations" />
            <Field label="What this role is for" value={role.description} onChange={onDescribe}
              placeholder="e.g. Books and tracks jobs, no billing" hint="Shown when choosing a role for a person" />
            <Group justify="space-between" mt={4}>
              <Button size="xs" variant="subtle" color="red" onClick={remove}>
                {confirming ? `Remove and unassign ${people === 1 ? '1 person' : `${people} people`}` : 'Remove role'}
              </Button>
              <Button size="xs" variant="default" onClick={() => setOpen(false)}>Done</Button>
            </Group>
          </Stack>
        </Popover.Dropdown>
      </Popover>
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <ActionIcon variant="subtle" color="gray" size="sm" aria-label={`More for ${label}`}><MoreHorizontal size={14} strokeWidth={1.5} /></ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item onClick={() => setOpen(true)}>Edit name and description</Menu.Item>
          <Menu.Item onClick={() => onAll(true)} disabled={role.tiles.length === tiles.length}>Turn on every tile</Menu.Item>
          <Menu.Item onClick={() => onAll(false)} disabled={empty}>Turn off every tile</Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Group>
  )
}
