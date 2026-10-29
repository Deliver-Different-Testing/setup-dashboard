import { Box, Checkbox, Grid, Paper, SimpleGrid, Stack, Text as MText, TextInput } from '@mantine/core'
import type { DayWindowRow, ScheduleRow } from '../../lib/api'
import { StepFrame } from '../StepFrame'
import { useDraft } from '../useDraft'
import { Btn, Card, Pick, RemoveBtn, Text } from '../ui'
import { asOptions, csv, patchAt, removeAt, useLookup } from '../../lib/helpers'

const Col = Grid.Col

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const ORIGINS = [
  { value: 'depot', label: 'Depot (pickup at a depot)' },
  { value: 'client', label: "Client address (pickup at the customer's address)" },
  { value: 'direct', label: 'Direct (no pickup leg)' },
]

export function SchedulesStep() {
  const { draft, setDraft, dirty, markSaved } = useDraft<ScheduleRow[]>(s => s.schedules)
  // Depots (tblBulkRegion) and speeds (tucJobType) are the same tables Routed Ops reads.
  const depots = useLookup('depots')
  const speeds = useLookup('speeds')
  const depotOpts = asOptions(depots.data)
  const patch = (i: number, p: Partial<ScheduleRow>) => setDraft(d => patchAt(d, i, p))

  return (
    <StepFrame step="schedules" title="Schedules" sendsTo="Routed Operations" draft={draft} dirty={dirty} onSaved={markSaved}
      intro={<>
        Created in Routed Operations &gt; Schedules (NEW). Each needs a destination depot and at least one day window. A schedule with no
        customer codes is the <b>default for every customer</b>; client-address schedules can't be the default, so they need customers and
        an origin depot. Depots themselves are created by DFRNT for now.
      </>}>
      <Card title={`Schedules (${draft.length})`} right={<Btn kind="ghost" onClick={() => setDraft(d => [...d, { dayWindows: [], clientCodes: [] }])}>+ Schedule</Btn>}>
        {depots.data && depots.data.length === 0 && <MText size="xs" c="var(--mantine-color-orange-text)" mb={8}>This tenant has no depots yet - schedules can't be created until DFRNT adds them.</MText>}
        <Stack gap="lg">
          {draft.map((s, i) => (
            <Paper key={i} withBorder p="sm" radius="md" shadow="none">
              <Grid columns={6} gutter={8} align="flex-end" overflow="visible">
                <Col span={2}><Text label="Name" required value={s.name} onChange={v => patch(i, { name: v })} /></Col>
                <Col span={1}><Pick label="Destination depot" required value={s.regionId} options={depotOpts} loading={depots.loading} onChange={v => patch(i, { regionId: v })} /></Col>
                <Col span={2}><Pick label="Origin" required value={s.originType} options={ORIGINS} onChange={v => patch(i, { originType: v })} /></Col>
                <Col span={1}><RemoveBtn onClick={() => setDraft(d => removeAt(d, i))} /></Col>
                {s.originType === 'depot' && <Col span={1}><Pick label="Pickup depot" required value={s.pickupDepotId} options={depotOpts} onChange={v => patch(i, { pickupDepotId: v })} /></Col>}
                {s.originType === 'client' && <Col span={1}><Pick label="Origin depot" required value={s.originRegionId} options={depotOpts} onChange={v => patch(i, { originRegionId: v })} /></Col>}
                <Col span={1}><Pick label="Speed" value={s.speedId} options={asOptions(speeds.data)} loading={speeds.loading} onChange={v => patch(i, { speedId: v })} /></Col>
                <Col span={3}><Text label="Customer codes" hint={s.originType === 'client' ? 'required for client address' : 'blank = default for every customer'}
                  required={s.originType === 'client'} value={s.clientCodes.join(', ')} onChange={v => patch(i, { clientCodes: csv(v) })} /></Col>
              </Grid>
              <DayWindows windows={s.dayWindows} onChange={w => patch(i, { dayWindows: w })} />
            </Paper>
          ))}
        </Stack>
      </Card>
    </StepFrame>
  )
}

function DayWindows({ windows, onChange }: { windows: DayWindowRow[]; onChange: (w: DayWindowRow[]) => void }) {
  const byDay = (d: number) => windows.find(w => w.dayOfWeek === d)
  const setDay = (d: number, p: Partial<DayWindowRow> | null) => {
    const rest = windows.filter(w => w.dayOfWeek !== d)
    onChange(p === null ? rest : [...rest, { ...(byDay(d) ?? { dayOfWeek: d }), ...p }].sort((a, b) => (a.dayOfWeek ?? 0) - (b.dayOfWeek ?? 0)))
  }
  return (
    <Box mt="sm">
      <MText fz={11} fw={600} tt="uppercase" lts={0.5} c="dimmed">Day windows<MText span inherit c="var(--mantine-color-red-text)" ml={2}>*</MText></MText>
      <SimpleGrid cols={7} spacing={8} mt={4}>
        {DAYS.map((name, idx) => {
          const d = idx + 1
          const w = byDay(d)
          return (
            <Paper key={d} withBorder p={8} radius="sm" shadow="none"
              bg={w ? 'var(--mantine-primary-color-light)' : undefined}
              style={w ? { borderColor: 'var(--mantine-primary-color-filled)' } : undefined}>
              <Checkbox size="xs" label={name} checked={!!w} onChange={e => setDay(d, e.currentTarget.checked ? {} : null)}
                styles={{ label: { fontSize: 'var(--mantine-font-size-xs)', fontWeight: 600 } }} />
              {w && (
                <Stack gap={4} mt={4}>
                  <TextInput type="time" size="xs" value={w.startTime ?? ''} onChange={e => setDay(d, { startTime: e.currentTarget.value || undefined })} title="Start" aria-label={`${name} start`} />
                  <TextInput type="time" size="xs" value={w.endTime ?? ''} onChange={e => setDay(d, { endTime: e.currentTarget.value || undefined })} title="End" aria-label={`${name} end`} />
                  <TextInput type="time" size="xs" c="dimmed" value={w.cutoffTime ?? ''} onChange={e => setDay(d, { cutoffTime: e.currentTarget.value || undefined })} title="Booking cutoff (optional)" aria-label={`${name} booking cutoff`} />
                </Stack>
              )}
            </Paper>
          )
        })}
      </SimpleGrid>
      <MText fz={11} c="dimmed" mt={4}>Start, end, and an optional booking cutoff per day.</MText>
    </Box>
  )
}
